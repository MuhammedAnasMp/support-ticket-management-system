"""
Report Registry — Model Introspection & Whitelist Engine

Provides a singleton registry where Django models are explicitly registered
as reportable data sources. Uses Django _meta introspection to discover
fields, types, and relationships — but only exposes whitelisted fields.
"""

from django.db import models
from django.apps import apps


class RegisteredModel:
    """Configuration for a single reportable model."""

    def __init__(
        self,
        model_class,
        label: str,
        allowed_fields: list[str] | None = None,
        hidden_fields: list[str] | None = None,
        allowed_relations: dict[str, int] | None = None,
        data_filter_fn=None,
        description: str = '',
    ):
        self.model_class = model_class
        self.label = label
        self.description = description
        self.allowed_fields = set(allowed_fields) if allowed_fields else None  # None = all non-hidden
        self.hidden_fields = set(hidden_fields or [])
        self.allowed_relations = allowed_relations or {}
        self.data_filter_fn = data_filter_fn  # callable(user) -> Q() | dict

    @property
    def registry_key(self):
        meta = self.model_class._meta
        return f"{meta.app_label}.{meta.model_name}"


class ReportRegistry:
    """Singleton registry of all reportable models."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._registry = {}
        return cls._instance

    def register(self, registered_model: RegisteredModel):
        key = registered_model.registry_key
        self._registry[key] = registered_model

    def get(self, key: str) -> RegisteredModel | None:
        return self._registry.get(key)

    def list_sources(self) -> list[dict]:
        sources = []
        for key, rm in self._registry.items():
            sources.append({
                'key': key,
                'label': rm.label,
                'description': rm.description,
            })
        return sorted(sources, key=lambda s: s['label'])

    def get_field_tree(self, key: str, max_depth: int = 3) -> list[dict]:
        rm = self.get(key)
        if not rm:
            return []
        return self._build_field_tree(rm.model_class, rm, depth=0, max_depth=max_depth, visited=set())

    def _build_field_tree(self, model_class, rm: RegisteredModel, depth: int, max_depth: int, visited: set, path_prefix: str = '') -> list[dict]:
        if depth > max_depth:
            return []

        model_key = f"{model_class._meta.app_label}.{model_class._meta.model_name}"
        if model_key in visited and depth > 0:
            return []

        visited = visited | {model_key}
        fields = []

        # Concrete fields on this model
        for field in model_class._meta.get_fields():
            field_name = field.name

            # Skip reverse relations at depth > 0 to avoid infinite loops
            if isinstance(field, (models.ManyToOneRel, models.ManyToManyRel)):
                if depth > 0:
                    continue
                # At root level, allow reverse relations if registered
                rel_model = field.related_model
                rel_key = f"{rel_model._meta.app_label}.{rel_model._meta.model_name}"
                rel_name = field.get_accessor_name() or field.name

                # Check if this reverse relation is allowed
                if rm.allowed_relations and rel_name not in rm.allowed_relations:
                    continue

                rel_max_depth = rm.allowed_relations.get(rel_name, 1) if rm.allowed_relations else 1
                rel_rm = registry.get(rel_key)

                child_fields = []
                if rel_rm and depth + 1 <= rel_max_depth:
                    child_fields = self._build_field_tree(
                        rel_model, rel_rm, depth + 1, min(max_depth, rel_max_depth),
                        visited, path_prefix=f"{path_prefix}{rel_name}__"
                    )

                fields.append({
                    'name': rel_name,
                    'path': f"{path_prefix}{rel_name}",
                    'label': self._humanize(rel_name),
                    'type': 'reverse_relation',
                    'relation_type': 'one_to_many',
                    'related_model': rel_key,
                    'children': child_fields,
                    'is_aggregatable': True,
                })
                continue

            # Skip hidden fields
            if field_name in rm.hidden_fields:
                continue

            # Apply whitelist if defined
            if rm.allowed_fields and field_name not in rm.allowed_fields:
                # Still allow FK traversal if the FK itself leads to allowed data
                if not isinstance(field, (models.ForeignKey, models.OneToOneField)):
                    continue

            full_path = f"{path_prefix}{field_name}"

            # FK / OneToOne — recurse into related model
            if isinstance(field, (models.ForeignKey, models.OneToOneField)):
                rel_model = field.related_model
                rel_key = f"{rel_model._meta.app_label}.{rel_model._meta.model_name}"
                rel_rm = registry.get(rel_key)

                child_fields = []
                if rel_rm and depth + 1 <= max_depth:
                    child_fields = self._build_field_tree(
                        rel_model, rel_rm, depth + 1, max_depth,
                        visited, path_prefix=f"{full_path}__"
                    )

                fields.append({
                    'name': field_name,
                    'path': full_path,
                    'label': self._humanize(field_name),
                    'type': 'relation',
                    'relation_type': 'foreign_key',
                    'related_model': rel_key,
                    'nullable': field.null,
                    'children': child_fields,
                })
                continue

            # M2M — skip for now (complex)
            if isinstance(field, models.ManyToManyField):
                continue

            # Regular data fields
            field_info = self._get_field_info(field)
            field_info['name'] = field_name
            field_info['path'] = full_path
            field_info['label'] = self._humanize(field_name)
            fields.append(field_info)

        return fields

    def _get_field_info(self, field) -> dict:
        """Extract metadata about a concrete model field."""
        info = {
            'nullable': getattr(field, 'null', False),
            'type': 'text',  # default
            'choices': None,
            'is_aggregatable': False,
        }

        if isinstance(field, (models.IntegerField, models.SmallIntegerField,
                              models.BigIntegerField, models.PositiveIntegerField,
                              models.PositiveSmallIntegerField)):
            info['type'] = 'integer'
            info['is_aggregatable'] = True
        elif isinstance(field, (models.DecimalField, models.FloatField)):
            info['type'] = 'decimal'
            info['is_aggregatable'] = True
        elif isinstance(field, models.BooleanField):
            info['type'] = 'boolean'
        elif isinstance(field, models.DateTimeField):
            info['type'] = 'datetime'
        elif isinstance(field, models.DateField):
            info['type'] = 'date'
        elif isinstance(field, models.TimeField):
            info['type'] = 'time'
        elif isinstance(field, (models.CharField, models.TextField)):
            info['type'] = 'text'
        elif isinstance(field, (models.FileField, models.ImageField)):
            info['type'] = 'file'
        elif isinstance(field, models.AutoField):
            info['type'] = 'integer'
            info['is_aggregatable'] = True

        # Extract choices
        if hasattr(field, 'choices') and field.choices:
            info['choices'] = [
                {'value': c[0], 'label': str(c[1])}
                for c in field.choices
            ]

        return info

    @staticmethod
    def _humanize(name: str) -> str:
        """Convert snake_case to Title Case friendly label."""
        return name.replace('_', ' ').replace('  ', ' ').strip().title()


# Global singleton
registry = ReportRegistry()


# ─────────────────────────────────────────────────────
# Register all reportable models
# ─────────────────────────────────────────────────────

# Shared hidden fields that must NEVER be exposed
_USER_HIDDEN = {
    'password', 'last_login', 'is_superuser', 'is_staff',
    'date_joined', 'groups', 'user_permissions',
    'logentry', 'push_subscriptions',
}


def _ticket_data_filter(user):
    """Row-level security for Ticket queries."""
    from django.db.models import Q

    if user.is_superuser:
        return Q()

    role_name = user.role.role_name.lower() if user.role else ''

    if role_name in ('office administrator', 'admin'):
        # Office admins see tickets for their departments
        user_dept_ids = list(
            user.sub_departments.values_list('department_id', flat=True).distinct()
        )
        if user_dept_ids:
            return Q(department_id__in=user_dept_ids)
        return Q()

    if role_name == 'store manager':
        store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
        return Q(store_id__in=store_ids)

    if role_name in ('worker', 'technician'):
        return Q(allocations__worker=user)

    # Default: only own tickets
    return Q(created_by=user)


def _store_data_filter(user):
    from django.db.models import Q
    if user.is_superuser:
        return Q()
    store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
    if store_ids:
        return Q(store_id__in=store_ids)
    return Q()


def _user_data_filter(user):
    from django.db.models import Q
    if user.is_superuser:
        return Q()
    return Q(active=True)


def _register_models():
    """Register all reportable models. Called once at app ready."""

    try:
        from apps.accounts.models import CustomUser, Role
        from apps.stores.models import Store, Area, Department, SubDepartment
        from apps.maintenance.models import (
            Ticket, Priority, Status, WorkNature, NatureWorker,
            Allocation, WorkLog, TicketHistory, TicketChatMessage,
        )
        from apps.finance.models import (
            ExpenseType, EmployeeRate, Expense, Reconciliation,
        )
        from apps.common.models import MediaCategory, Media, Notification
    except Exception:
        return  # Models not yet loaded

    # ── Accounts ──
    registry.register(RegisteredModel(
        model_class=CustomUser,
        label='User / Employee',
        hidden_fields=_USER_HIDDEN | {'password_reset_otps', 'whatsapp_logs'},
        description='Application users including workers, managers, and admins.',
        data_filter_fn=_user_data_filter,
    ))

    registry.register(RegisteredModel(
        model_class=Role,
        label='Role',
        description='User access roles (Store Manager, Worker, Admin, etc.).',
    ))

    # ── Stores ──
    registry.register(RegisteredModel(
        model_class=Area,
        label='Area / Governorate',
        description='Geographical regions in Kuwait.',
    ))

    registry.register(RegisteredModel(
        model_class=Store,
        label='Store / Location',
        hidden_fields={'whatsapp_number', 'phone'},
        description='Retail store locations with coordinates.',
        data_filter_fn=_store_data_filter,
    ))

    registry.register(RegisteredModel(
        model_class=Department,
        label='Department',
        description='Organizational departments (Maintenance, IT, etc.).',
    ))

    registry.register(RegisteredModel(
        model_class=SubDepartment,
        label='Sub Department',
        description='Specialized units within a department.',
    ))

    # ── Maintenance ──
    registry.register(RegisteredModel(
        model_class=Ticket,
        label='Ticket / Work Order',
        hidden_fields={'device_info'},
        allowed_relations={
            'allocations': 2,
            'work_logs': 2,
            'expenses': 2,
            'history': 2,
            'attachments': 1,
            'reconciliation': 2,
        },
        description='Core maintenance work order tickets.',
        data_filter_fn=_ticket_data_filter,
    ))

    registry.register(RegisteredModel(
        model_class=Priority,
        label='Priority',
        description='Ticket priority levels (Critical, High, Medium, Low).',
    ))

    registry.register(RegisteredModel(
        model_class=Status,
        label='Status',
        description='Workflow statuses (Open, In Progress, Completed, etc.).',
    ))

    registry.register(RegisteredModel(
        model_class=WorkNature,
        label='Work Nature',
        description='Types of maintenance work.',
    ))

    registry.register(RegisteredModel(
        model_class=Allocation,
        label='Allocation / Assignment',
        hidden_fields={'voice_note'},
        description='Worker assignments to tickets.',
    ))

    registry.register(RegisteredModel(
        model_class=WorkLog,
        label='Work Log',
        description='Logged labor hours and costs.',
    ))

    registry.register(RegisteredModel(
        model_class=TicketHistory,
        label='Ticket History',
        description='Audit trail of ticket status changes.',
    ))

    # ── Finance ──
    registry.register(RegisteredModel(
        model_class=ExpenseType,
        label='Expense Type',
        description='Categories of expenses.',
    ))

    registry.register(RegisteredModel(
        model_class=EmployeeRate,
        label='Employee Rate',
        description='Worker hourly pay rates.',
    ))

    registry.register(RegisteredModel(
        model_class=Expense,
        label='Expense',
        description='Financial expenses attached to tickets.',
    ))

    registry.register(RegisteredModel(
        model_class=Reconciliation,
        label='Reconciliation',
        description='Final financial verification per ticket.',
    ))

    # ── Common ──
    registry.register(RegisteredModel(
        model_class=MediaCategory,
        label='Media Category',
        description='Upload categories (Before Repair, After Repair, etc.).',
    ))

    registry.register(RegisteredModel(
        model_class=Media,
        label='Media / Attachment',
        description='Uploaded images, videos, and documents.',
    ))


# Run registration
_register_models()
