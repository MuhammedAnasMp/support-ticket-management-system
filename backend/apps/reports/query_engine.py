"""
Report Query Engine — Safe QuerySet Builder

Converts a report definition JSON into Django ORM queries.
Uses subquery annotations for aggregations to prevent Cartesian product issues.
Applies row-level security via registry data_filter_fn.
"""

import time
from decimal import Decimal

from django.db.models import (
    Q, F, Value, Count, Sum, Avg, Min, Max,
    Subquery, OuterRef, CharField, DecimalField,
    IntegerField, DateField, DateTimeField,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from .registry import registry


# Maximum rows a report can return
MAX_REPORT_ROWS = 10_000

# Lookup operators mapping
LOOKUP_MAP = {
    'equals': 'exact',
    'not_equals': 'exact',         # negated via ~Q
    'contains': 'icontains',
    'not_contains': 'icontains',   # negated via ~Q
    'starts_with': 'istartswith',
    'ends_with': 'iendswith',
    'gt': 'gt',
    'gte': 'gte',
    'lt': 'lt',
    'lte': 'lte',
    'in': 'in',
    'not_in': 'in',               # negated via ~Q
    'is_null': 'isnull',
    'is_not_null': 'isnull',       # negated via ~Q
    'range': 'range',
    'date_equals': 'date',
    'year': 'year',
    'month': 'month',
}

# Aggregation function mapping
AGG_MAP = {
    'count': Count,
    'sum': Sum,
    'avg': Avg,
    'min': Min,
    'max': Max,
}


class QueryEngineError(Exception):
    """Raised for invalid query configurations."""
    pass


class ReportQueryEngine:
    """
    Build a Django QuerySet from a report definition dict.

    Expected definition schema:
    {
        "columns": [
            {"path": "work_order_no", "label": "WO#", "width": 80},
            {"path": "store__store_name", "label": "Store"},
            {"path": "priority__priority_name", "label": "Priority"},
        ],
        "filters": {
            "logic": "AND",
            "conditions": [
                {"path": "status__status_name", "operator": "equals", "value": "Open"},
                {"path": "created_date", "operator": "gte", "value": "2025-01-01"},
            ]
        },
        "sorting": [
            {"path": "created_date", "direction": "desc"},
        ],
        "grouping": {
            "fields": ["store__store_name"],
            "aggregations": [
                {"path": "ticket_id", "function": "count", "label": "Total Tickets"},
                {"path": "expenses__amount", "function": "sum", "label": "Total Expenses"},
            ]
        },
        "aggregations": [
            {"path": "ticket_id", "function": "count", "label": "Total Count"},
        ]
    }
    """

    def __init__(self, data_source: str, definition: dict, user, runtime_filters: dict | None = None):
        self.data_source = data_source
        self.definition = definition
        self.user = user
        self.runtime_filters = runtime_filters or {}
        self.rm = registry.get(data_source)
        if not self.rm:
            raise QueryEngineError(f"Data source '{data_source}' is not registered.")
        self.model = self.rm.model_class

    def build_queryset(self) -> tuple:
        """
        Build and return (queryset, column_paths, is_grouped).

        Returns:
            queryset: Django QuerySet
            column_paths: list of field paths for data extraction
            is_grouped: whether this is a grouped/aggregated query
        """
        start = time.time()

        qs = self.model.objects.all()

        # 1. Apply row-level security
        qs = self._apply_security(qs)

        # 2. Apply definition filters
        qs = self._apply_filters(qs, self.definition.get('filters'))

        # 3. Apply runtime filters (user-provided at generation time)
        qs = self._apply_runtime_filters(qs)

        # 4. Determine columns
        columns = self.definition.get('columns', [])
        column_paths = [c['path'] for c in columns]

        # 5. Check for grouping
        grouping = self.definition.get('grouping')
        is_grouped = bool(grouping and grouping.get('fields'))

        if is_grouped:
            qs = self._apply_grouping(qs, grouping, column_paths)
        else:
            # Safely apply select_related (FKs only) and prefetch_related (Reverse relations/M2M)
            select_fields, prefetch_fields = self._extract_relation_paths(column_paths)
            if select_fields:
                qs = qs.select_related(*select_fields)
            if prefetch_fields:
                qs = qs.prefetch_related(*prefetch_fields)

            # Apply subquery annotations for reverse-relation aggregations
            aggregations = self.definition.get('aggregations', [])
            qs = self._apply_subquery_aggregations(qs, aggregations)

        # 6. Apply sorting
        qs = self._apply_sorting(qs)

        # 7. Apply distinct to avoid duplicates
        if not is_grouped:
            qs = qs.distinct()

        # 8. Enforce row limit
        qs = qs[:MAX_REPORT_ROWS]

        duration_ms = int((time.time() - start) * 1000)
        return qs, column_paths, is_grouped, duration_ms

    def _apply_security(self, qs):
        """Apply row-level data filters based on user role."""
        if self.rm.data_filter_fn:
            security_filter = self.rm.data_filter_fn(self.user)
            if isinstance(security_filter, Q):
                qs = qs.filter(security_filter)
            elif isinstance(security_filter, dict):
                qs = qs.filter(**security_filter)
        return qs

    def _apply_filters(self, qs, filters_config):
        """Build Q objects from the filter definition."""
        if not filters_config:
            return qs

        q = self._build_q(filters_config)
        if q:
            qs = qs.filter(q)
        return qs

    def _build_q(self, filter_config) -> Q | None:
        """Recursively build Q objects from filter config."""
        if not filter_config:
            return None

        logic = filter_config.get('logic', 'AND').upper()
        conditions = filter_config.get('conditions', [])

        if not conditions:
            return None

        q_objects = []
        for condition in conditions:
            # Nested group
            if 'logic' in condition and 'conditions' in condition:
                sub_q = self._build_q(condition)
                if sub_q:
                    q_objects.append(sub_q)
                continue

            path = condition.get('path', '')
            operator = condition.get('operator', 'equals')
            value = condition.get('value')

            if not path:
                continue

            q_obj = self._condition_to_q(path, operator, value)
            if q_obj is not None:
                q_objects.append(q_obj)

        if not q_objects:
            return None

        combined = q_objects[0]
        for q_obj in q_objects[1:]:
            if logic == 'OR':
                combined = combined | q_obj
            else:
                combined = combined & q_obj

        return combined

    def _condition_to_q(self, path: str, operator: str, value) -> Q | None:
        """Convert a single condition to a Q object."""
        negate = operator in ('not_equals', 'not_contains', 'not_in', 'is_not_null')

        if operator in ('is_null', 'is_not_null'):
            value = True

        if operator == 'in' or operator == 'not_in':
            if isinstance(value, str):
                value = [v.strip() for v in value.split(',')]

        if operator == 'range':
            if isinstance(value, (list, tuple)) and len(value) == 2:
                value = tuple(value)
            else:
                return None

        lookup = LOOKUP_MAP.get(operator)
        if not lookup:
            return None

        django_path = path.replace('.', '__')
        lookup_key = f"{django_path}__{lookup}"

        q = Q(**{lookup_key: value})
        if negate:
            q = ~q

        return q

    def _apply_runtime_filters(self, qs):
        """Apply additional filters passed at report generation time."""
        if not self.runtime_filters:
            return qs

        runtime_config = {
            'logic': 'AND',
            'conditions': [],
        }

        for path, value in self.runtime_filters.items():
            if value is not None and value != '':
                runtime_config['conditions'].append({
                    'path': path,
                    'operator': 'equals',
                    'value': value,
                })

        return self._apply_filters(qs, runtime_config)

    def _apply_sorting(self, qs):
        """Apply ORDER BY from sorting config."""
        sorting = self.definition.get('sorting', [])
        if not sorting:
            # Default: sort by PK
            pk_name = self.model._meta.pk.name if self.model._meta.pk else 'pk'
            return qs.order_by(f'-{pk_name}')

        order_fields = []
        for sort_item in sorting:
            path = sort_item.get('path', '').replace('.', '__')
            direction = sort_item.get('direction', 'asc').lower()
            if path:
                order_fields.append(f"-{path}" if direction == 'desc' else path)

        if order_fields:
            qs = qs.order_by(*order_fields)
        return qs

    def _apply_grouping(self, qs, grouping, column_paths):
        """Apply GROUP BY with aggregation annotations."""
        group_fields = [f.replace('.', '__') for f in grouping.get('fields', [])]
        aggregations = grouping.get('aggregations', [])

        if not group_fields:
            return qs

        qs = qs.values(*group_fields)

        # Apply aggregation annotations
        annotations = {}
        for agg in aggregations:
            agg_path = agg.get('path', '').replace('.', '__')
            agg_func_name = agg.get('function', 'count').lower()
            agg_label = agg.get('label', f'{agg_func_name}_{agg_path}')
            agg_alias = self._safe_alias(agg_label)

            agg_class = AGG_MAP.get(agg_func_name)
            if agg_class and agg_path:
                annotations[agg_alias] = agg_class(agg_path)

        if annotations:
            qs = qs.annotate(**annotations)

        return qs

    def _apply_subquery_aggregations(self, qs, aggregations):
        """
        Use Subquery annotations for aggregations on reverse relations.
        This prevents Cartesian products when multiple one-to-many joins exist.
        """
        if not aggregations:
            return qs

        pk_name = self.model._meta.pk.name if self.model._meta.pk else 'pk'

        for agg in aggregations:
            agg_path = agg.get('path', '')
            agg_func_name = agg.get('function', 'count').lower()
            agg_label = agg.get('label', f'{agg_func_name}_{agg_path}')
            agg_alias = self._safe_alias(agg_label)

            if '__' not in agg_path:
                # Direct field — safe to annotate normally
                agg_class = AGG_MAP.get(agg_func_name)
                if agg_class:
                    qs = qs.annotate(**{agg_alias: agg_class(agg_path)})
                continue

            # Reverse relation path: e.g., "expenses__amount"
            # Split into relation name and field
            parts = agg_path.split('__')
            relation_name = parts[0]
            field_path = '__'.join(parts[1:])

            # Find the related model through the relation
            try:
                rel = self.model._meta.get_field(relation_name)
                if hasattr(rel, 'related_model'):
                    related_model = rel.related_model
                elif hasattr(rel, 'field'):
                    related_model = rel.field.model
                else:
                    continue

                # Build subquery
                fk_field = self._find_fk_field(related_model, self.model)
                if not fk_field:
                    continue

                sub_qs = related_model.objects.filter(
                    **{fk_field: OuterRef(pk_name)}
                ).values(fk_field)

                agg_class = AGG_MAP.get(agg_func_name)
                if not agg_class:
                    continue

                sub_qs = sub_qs.annotate(agg_val=agg_class(field_path)).values('agg_val')

                # Use Coalesce to default NULL to 0 for numeric aggregations
                if agg_func_name in ('sum', 'count', 'avg'):
                    qs = qs.annotate(**{
                        agg_alias: Coalesce(Subquery(sub_qs), Value(0))
                    })
                else:
                    qs = qs.annotate(**{agg_alias: Subquery(sub_qs)})

            except Exception:
                continue

        return qs

    def _find_fk_field(self, child_model, parent_model) -> str | None:
        """Find the FK field name on child_model that points to parent_model."""
        for field in child_model._meta.get_fields():
            if isinstance(field, (
                    child_model._meta.get_field.__func__.__class__
                    if hasattr(child_model._meta.get_field, '__func__') else type(None),
            )):
                continue
            if hasattr(field, 'related_model') and field.related_model == parent_model:
                return field.name
        return None

    def _extract_relation_paths(self, column_paths: list[str]) -> tuple[list[str], list[str]]:
        """
        Safely categorize relation paths into select_related (Forward FK/OneToOne only)
        and prefetch_related (Reverse relations / M2M).
        """
        select_fields = set()
        prefetch_fields = set()

        for path in column_paths:
            parts = path.replace('.', '__').split('__')
            if len(parts) <= 1:
                continue

            current_model = self.model
            valid_select_chain = []
            is_prefetch = False

            for part in parts[:-1]:
                try:
                    field = current_model._meta.get_field(part)
                    if isinstance(field, (models.ForeignKey, models.OneToOneField)):
                        valid_select_chain.append(part)
                        current_model = field.related_model
                    elif isinstance(field, (models.ManyToOneRel, models.ManyToManyRel, models.ManyToManyField)):
                        is_prefetch = True
                        prefetch_fields.add('__'.join(valid_select_chain + [part]))
                        break
                    else:
                        break
                except Exception:
                    break

            if not is_prefetch and valid_select_chain:
                select_fields.add('__'.join(valid_select_chain))

        return list(select_fields), list(prefetch_fields)

    @staticmethod
    def _safe_alias(label: str) -> str:
        """Convert a human label to a safe Python/SQL alias."""
        alias = label.lower().replace(' ', '_').replace('-', '_')
        alias = ''.join(c for c in alias if c.isalnum() or c == '_')
        if alias and alias[0].isdigit():
            alias = f'agg_{alias}'
        return alias or 'agg_value'


def execute_report(data_source: str, definition: dict, user, runtime_filters=None, export_format='preview'):
    """
    High-level function to execute a report and return structured data.

    Returns:
        dict with keys: rows, columns, row_count, duration_ms, aggregation_values
    """
    engine = ReportQueryEngine(data_source, definition, user, runtime_filters)
    qs, column_paths, is_grouped, duration_ms = engine.build_queryset()

    columns = definition.get('columns', [])

    if is_grouped:
        # Grouped results are already dicts from .values()
        rows = list(qs)
    else:
        rows = _extract_rows(qs, columns)

    # Compute grand total aggregations
    aggregation_values = {}
    aggregations = definition.get('aggregations', [])
    if aggregations and not is_grouped:
        for agg in aggregations:
            alias = ReportQueryEngine._safe_alias(agg.get('label', ''))
            agg_func = agg.get('function', 'count')
            agg_path = agg.get('path', '').replace('.', '__')
            try:
                agg_class = AGG_MAP.get(agg_func)
                if agg_class:
                    security_qs = engine.model.objects.all()
                    security_qs = engine._apply_security(security_qs)
                    security_qs = engine._apply_filters(security_qs, definition.get('filters'))
                    result = security_qs.aggregate(**{alias: agg_class(agg_path)})
                    aggregation_values[alias] = result.get(alias)
            except Exception:
                aggregation_values[alias] = None

    # Compute KPI Cards
    kpi_cards = []
    for kpi in definition.get('kpi_cards', []):
        func_name = kpi.get('function', 'count').lower()
        path = kpi.get('path', '').replace('.', '__')
        label = kpi.get('label', f"{func_name.upper()} of {path}")
        color = kpi.get('color', 'blue')

        try:
            agg_class = AGG_MAP.get(func_name)
            if agg_class and path:
                sec_qs = engine.model.objects.all()
                sec_qs = engine._apply_security(sec_qs)
                sec_qs = engine._apply_filters(sec_qs, definition.get('filters'))
                val = sec_qs.aggregate(kpi_val=agg_class(path))['kpi_val']
                val_formatted = float(val) if isinstance(val, Decimal) else (val or 0)
            else:
                val_formatted = len(rows)
        except Exception:
            val_formatted = len(rows)

        kpi_cards.append({
            'label': label,
            'value': val_formatted,
            'color': color,
        })

    # Generate Charts
    generated_charts = []
    theme_key = definition.get('theme', 'corporate_blue')
    for chart_cfg in definition.get('charts', []):
        c_type = chart_cfg.get('type', 'bar')
        c_title = chart_cfg.get('title', 'Chart')
        group_by = chart_cfg.get('group_by', '').replace('.', '__')
        agg_func = chart_cfg.get('aggregate_func', 'count').lower()
        agg_field = chart_cfg.get('aggregate_field', '').replace('.', '__') or group_by

        if not group_by:
            continue

        try:
            sec_qs = engine.model.objects.all()
            sec_qs = engine._apply_security(sec_qs)
            sec_qs = engine._apply_filters(sec_qs, definition.get('filters'))

            agg_class = AGG_MAP.get(agg_func, Count)
            chart_qs = sec_qs.values(group_by).annotate(chart_val=agg_class(agg_field)).order_by('-chart_val')[:10]

            labels = [str(item[group_by] or 'Unknown') for item in chart_qs]
            values = [float(item['chart_val']) if isinstance(item['chart_val'], Decimal) else item['chart_val'] for item in chart_qs]

            from .chart_engine import generate_chart_image
            img_data = generate_chart_image(c_type, c_title, labels, values, theme=theme_key)

            if img_data:
                generated_charts.append({
                    'title': c_title,
                    'type': c_type,
                    'image': img_data,
                    'data': [{'label': l, 'value': v} for l, v in zip(labels, values)],
                })
        except Exception as e:
            pass

    return {
        'rows': rows,
        'columns': [
            {
                'path': c.get('path', ''),
                'label': c.get('label', c.get('path', '')),
                'type': c.get('type', 'text'),
                'width': c.get('width'),
                'alignment': c.get('alignment', 'left'),
                'format': c.get('format'),
            }
            for c in columns
        ],
        'row_count': len(rows),
        'duration_ms': duration_ms,
        'aggregation_values': aggregation_values,
        'kpi_cards': kpi_cards,
        'charts': generated_charts,
        'is_grouped': is_grouped,
    }


def _extract_rows(qs, columns: list[dict]) -> list[dict]:
    """Extract row dicts from a queryset based on column paths."""
    column_paths = [c['path'] for c in columns]
    rows = []

    for obj in qs:
        row = {}
        for col in columns:
            path = col['path']
            value = _resolve_path(obj, path)
            # Serialize special types
            if isinstance(value, Decimal):
                value = float(value)
            elif hasattr(value, 'isoformat'):
                value = value.isoformat()
            elif value is not None and not isinstance(value, (str, int, float, bool)):
                value = str(value)
            row[path] = value
        rows.append(row)

    return rows


def _resolve_path(obj, path: str):
    """
    Navigate dotted/dunder path on a model instance.
    Handles forward FKs, OneToOne, and reverse One-to-Many relations cleanly.
    """
    parts = path.replace('.', '__').split('__')
    return _resolve_parts(obj, parts)


def _resolve_parts(current, parts: list[str]):
    if not parts:
        return current

    if current is None:
        return None

    # If current is a Manager / QuerySet / List (reverse relation)
    if hasattr(current, 'all') and callable(getattr(current, 'all')):
        items = list(current.all())
        resolved = [_resolve_parts(item, parts) for item in items]
        flattened = [str(x) for x in resolved if x is not None and str(x).strip()]
        return ', '.join(dict.fromkeys(flattened))

    if isinstance(current, (list, tuple)):
        resolved = [_resolve_parts(item, parts) for item in current]
        flattened = [str(x) for x in resolved if x is not None and str(x).strip()]
        return ', '.join(dict.fromkeys(flattened))

    part = parts[0]
    remaining = parts[1:]

    try:
        val = getattr(current, part, None)
    except Exception:
        return None

    if callable(val) and not isinstance(val, type) and not hasattr(val, 'all'):
        try:
            val = val()
        except Exception:
            return None

    return _resolve_parts(val, remaining)
