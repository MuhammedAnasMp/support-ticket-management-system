"""
HTML Renderer — Generates styled HTML for report preview and PDF conversion.
"""

from datetime import datetime

from .base import BaseRenderer

# ── Theme CSS definitions ──
THEME_CSS = {
    'corporate_blue': {
        'header_bg': '#1e3a5f',
        'header_text': '#ffffff',
        'accent': '#2563eb',
        'row_alt': '#f0f5ff',
        'border': '#d1d9e6',
        'group_bg': '#e8eef6',
        'total_bg': '#1e3a5f',
        'total_text': '#ffffff',
    },
    'maintenance': {
        'header_bg': '#1a1a2e',
        'header_text': '#e0e0e0',
        'accent': '#e94560',
        'row_alt': '#f5f0f0',
        'border': '#d4d0d0',
        'group_bg': '#fce4ec',
        'total_bg': '#1a1a2e',
        'total_text': '#ffffff',
    },
    'finance': {
        'header_bg': '#0d4f3c',
        'header_text': '#ffffff',
        'accent': '#10b981',
        'row_alt': '#ecfdf5',
        'border': '#a7f3d0',
        'group_bg': '#d1fae5',
        'total_bg': '#0d4f3c',
        'total_text': '#ffffff',
    },
    'minimal': {
        'header_bg': '#f9fafb',
        'header_text': '#111827',
        'accent': '#6b7280',
        'row_alt': '#f9fafb',
        'border': '#e5e7eb',
        'group_bg': '#f3f4f6',
        'total_bg': '#374151',
        'total_text': '#ffffff',
    },
    'executive': {
        'header_bg': '#18181b',
        'header_text': '#fafafa',
        'accent': '#a78bfa',
        'row_alt': '#faf5ff',
        'border': '#e4e0ea',
        'group_bg': '#ede9fe',
        'total_bg': '#18181b',
        'total_text': '#fafafa',
    },
}


class HtmlRenderer(BaseRenderer):
    """Render report as styled HTML string."""

    @property
    def content_type(self):
        return 'text/html'

    @property
    def file_extension(self):
        return 'html'

    def render(self) -> str:
        theme = THEME_CSS.get(self.get_theme(), THEME_CSS['corporate_blue'])
        columns = self.get_columns()
        rows = self.get_rows()
        aggregations = self.get_aggregations()
        col_count = len(columns)
        orientation = self.get_orientation()
        page_size = self.get_page_size()

        # Automatic landscape switch if > 6 columns and not explicitly forced to portrait
        if col_count > 6 and self.definition.get('page_orientation') != 'portrait':
            orientation = 'landscape'

        # Page dimensions
        page_w = '210mm' if page_size == 'A4' else ('297mm' if page_size == 'A3' else '216mm')
        page_h = '297mm' if page_size == 'A4' else ('420mm' if page_size == 'A3' else '279mm')
        if orientation == 'landscape':
            page_w, page_h = page_h, page_w

        # Dynamic sizing based on column count
        if col_count <= 6:
            font_size = '8.5pt'
            th_font_size = '8pt'
            cell_padding = '6px 8px'
        elif col_count <= 9:
            font_size = '7.5pt'
            th_font_size = '7pt'
            cell_padding = '4px 6px'
        else:
            font_size = '6.5pt'
            th_font_size = '6pt'
            cell_padding = '3px 4px'

        # Proportional column width headers
        total_weight = sum(c.get('width', 100) for c in columns) or 1
        th_cells = []
        for c in columns:
            w = c.get('width', 100)
            pct = round((w / total_weight) * 100, 1)
            align = c.get('alignment', 'left')
            label = self.format_value(c.get('label', c['path']), c)
            th_cells.append(f'<th class="align-{align}" style="width: {pct}%;">{label}</th>')
        th_html = ''.join(th_cells)

        # Build filter summary
        filters_summary = self._build_filter_summary()

        # Build rows HTML
        grouping = self.definition.get('grouping', {})
        group_fields = grouping.get('fields', []) if grouping else []

        if group_fields and self.report_data.get('is_grouped'):
            body_html = self._render_grouped_rows(columns, rows, theme, group_fields)
        else:
            body_html = self._render_detail_rows(columns, rows, theme)

        # Build aggregation footer
        agg_html = self._render_aggregation_footer(columns, aggregations, theme)
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M')

        # Phase 4 Polish Elements
        watermark_text = self.definition.get('watermark_text', '')
        enable_qr = self.definition.get('enable_qr', True)
        enable_signatures = self.definition.get('enable_signatures', False)

        watermark_html = ''
        if watermark_text:
            watermark_html = f"""
            <div style="position:fixed;top:40%;left:15%;right:15%;text-align:center;font-size:42pt;font-weight:900;color:rgba(200,200,200,0.22);transform:rotate(-30deg);z-index:-1;pointer-events:none;letter-spacing:0.1em;">
                {watermark_text.upper()}
            </div>"""

        qr_html = ''
        if enable_qr:
            from ..qr_utils import generate_qr_code_image
            qr_data = f"REPORT: {self.get_title()} | SOURCE: {self.report_data.get('data_source', '')} | ROWS: {len(rows)} | DATE: {now}"
            qr_img = generate_qr_code_image(qr_data, size=2)
            if qr_img:
                qr_html = f'<img src="{qr_img}" style="width:48px;height:48px;margin-left:12px;border:1px solid #d1d5db;border-radius:4px;padding:2px;background:#fff;" />'

        signatures_html = ''
        if enable_signatures:
            signatures_html = """
            <div style="margin-top:30px;padding-top:15px;border-top:1px solid #d1d5db;display:flex;justify-content:space-between;page-break-inside:avoid;">
                <div style="text-align:center;width:30%;">
                    <div style="border-bottom:1px solid #9ca3af;height:35px;margin-bottom:4px;"></div>
                    <div style="font-size:7.5pt;font-weight:600;color:#4b5563;">Prepared By</div>
                </div>
                <div style="text-align:center;width:30%;">
                    <div style="border-bottom:1px solid #9ca3af;height:35px;margin-bottom:4px;"></div>
                    <div style="font-size:7.5pt;font-weight:600;color:#4b5563;">Reviewed By</div>
                </div>
                <div style="text-align:center;width:30%;">
                    <div style="border-bottom:1px solid #9ca3af;height:35px;margin-bottom:4px;"></div>
                    <div style="font-size:7.5pt;font-weight:600;color:#4b5563;">Approved By</div>
                </div>
            </div>"""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{self.get_title()}</title>
<style>
@page {{
    size: {page_w} {page_h};
    margin: 12mm 10mm 15mm 10mm;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: {font_size};
    color: #1f2937;
    line-height: 1.4;
    background: #fff;
}}

/* Header */
.report-header {{
    padding: 12px 16px;
    background: {theme['header_bg']};
    color: {theme['header_text']};
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 4px 4px 0 0;
    margin-bottom: 0;
}}
.report-header h1 {{
    font-size: 15pt;
    font-weight: 700;
}}
.report-header .meta {{
    text-align: right;
    font-size: 7.5pt;
    opacity: 0.85;
    line-height: 1.6;
    display: flex;
    align-items: center;
}}

/* Filter summary */
.filter-summary {{
    padding: 6px 16px;
    background: {theme['row_alt']};
    border: 1px solid {theme['border']};
    border-top: none;
    font-size: 7.5pt;
    color: #6b7280;
}}
.filter-summary strong {{
    color: #374151;
}}

/* Table */
.report-table {{
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border: 1px solid {theme['border']};
    border-top: none;
    word-wrap: break-word;
    word-break: break-word;
    overflow-wrap: break-word;
}}
.report-table thead th {{
    background: {theme['header_bg']};
    color: {theme['header_text']};
    padding: {cell_padding};
    font-size: {th_font_size};
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 2px solid {theme['accent']};
    text-align: left;
    white-space: normal;
    word-wrap: break-word;
    word-break: break-word;
    overflow-wrap: break-word;
}}
.report-table thead th.align-right {{
    text-align: right;
}}
.report-table thead th.align-center {{
    text-align: center;
}}
.report-table tbody td {{
    padding: {cell_padding};
    border-bottom: 1px solid {theme['border']};
    font-size: {font_size};
    vertical-align: top;
    word-wrap: break-word;
    word-break: break-word;
    overflow-wrap: break-word;
}}
.report-table tbody tr:nth-child(even) {{
    background: {theme['row_alt']};
}}
.report-table tbody tr:hover {{
    background: {theme['group_bg']};
}}
.report-table td.align-right {{
    text-align: right;
    font-variant-numeric: tabular-nums;
}}
.report-table td.align-center {{
    text-align: center;
}}

/* Group header row */
.group-header-row td {{
    background: {theme['group_bg']} !important;
    font-weight: 700;
    font-size: 8.5pt;
    padding: 6px 10px !important;
    border-top: 2px solid {theme['accent']};
    color: {theme['header_bg']};
}}

/* Total footer row */
.total-row td {{
    background: {theme['total_bg']} !important;
    color: {theme['total_text']} !important;
    font-weight: 700;
    font-size: 8.5pt;
    padding: 6px 10px !important;
    border-top: 2px solid {theme['accent']};
}}

/* Footer */
.report-footer {{
    padding: 8px 20px;
    font-size: 7pt;
    color: #9ca3af;
    border-top: 1px solid {theme['border']};
    display: flex;
    justify-content: space-between;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
}}

/* Row count badge */
.row-count {{
    display: inline-block;
    padding: 3px 10px;
    background: {theme['accent']};
    color: #fff;
    border-radius: 12px;
    font-size: 7.5pt;
    font-weight: 600;
    margin-left: 12px;
}}

/* Print adjustments */
@media print {{
    .report-header {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    .report-table thead {{ display: table-header-group; }}
    .report-table tbody tr {{ page-break-inside: avoid; }}
    .total-row, .group-header-row {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
}}
</style>
</head>
<body>

{watermark_html}

<div class="report-header">
    <div>
        <h1>{self.get_title()}</h1>
        {'<p style="font-size:8pt;opacity:0.7;margin-top:3px;">' + self.get_subtitle() + '</p>' if self.get_subtitle() else ''}
    </div>
    <div class="meta">
        <div>
            Generated: {now}<br>
            <span class="row-count">{len(rows):,} rows</span>
        </div>
        {qr_html}
    </div>
</div>

{filters_summary}

{self._render_kpi_cards_html(theme)}

{self._render_charts_html()}

<table class="report-table">
<thead>
<tr>
    {th_html}
</tr>
</thead>
<tbody>
{body_html}
</tbody>
</table>

{agg_html}

{signatures_html}

</body>
</html>"""
        return html

    def _render_kpi_cards_html(self, theme) -> str:
        kpi_cards = self.report_data.get('kpi_cards', [])
        if not kpi_cards:
            return ''

        cards_html = []
        for card in kpi_cards:
            val = card.get('value', 0)
            val_str = f"{val:,.2f}" if isinstance(val, float) else f"{val:,}"
            cards_html.append(f"""
            <div style="flex:1;min-width:120px;padding:10px 14px;background:{theme['row_alt']};border:1px solid {theme['border']};border-radius:6px;">
                <div style="font-size:7pt;text-transform:uppercase;color:#6b7280;font-weight:600;">{card.get('label', '')}</div>
                <div style="font-size:14pt;font-weight:700;color:{theme['header_bg']};margin-top:2px;">{val_str}</div>
            </div>""")

        return f'<div style="display:flex;gap:10px;margin:10px 0;">{"".join(cards_html)}</div>'

    def _render_charts_html(self) -> str:
        charts = self.report_data.get('charts', [])
        if not charts:
            return ''

        charts_html = []
        for chart in charts:
            img_src = chart.get('image')
            if img_src:
                charts_html.append(f"""
                <div style="flex:1;min-width:280px;text-align:center;padding:8px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;">
                    <img src="{img_src}" style="max-width:100%;height:auto;" />
                </div>""")

        return f'<div style="display:flex;gap:12px;margin:12px 0;flex-wrap:wrap;">{"".join(charts_html)}</div>'

    def _render_detail_rows(self, columns, rows, theme) -> str:
        cond_formatting = self.definition.get('conditional_formatting', [])
        html_parts = []

        for row in rows:
            # Check conditional formatting
            row_style = ''
            for rule in cond_formatting:
                rule_path = rule.get('path', '')
                rule_op = rule.get('operator', 'equals')
                rule_val = str(rule.get('value', ''))
                row_val = str(row.get(rule_path, ''))

                match = False
                if rule_op == 'equals' and row_val.lower() == rule_val.lower():
                    match = True
                elif rule_op == 'contains' and rule_val.lower() in row_val.lower():
                    match = True

                if match:
                    bg = rule.get('bg_color', '')
                    text_c = rule.get('text_color', '')
                    if bg or text_c:
                        row_style = f'style="background-color:{bg} !important;color:{text_c} !important;"'
                    break

            cells = []
            for col in columns:
                value = row.get(col['path'])
                formatted = self.format_value(value, col)
                alignment = col.get('alignment', 'left')
                cells.append(f'<td class="align-{alignment}">{formatted}</td>')
            html_parts.append(f'<tr {row_style}>{"".join(cells)}</tr>')
        return '\n'.join(html_parts)

    def _render_grouped_rows(self, columns, rows, theme, group_fields) -> str:
        html_parts = []
        current_group = None
        for row in rows:
            group_key = tuple(row.get(f.replace('.', '__'), '') for f in group_fields)
            if group_key != current_group:
                current_group = group_key
                group_label = ' / '.join(str(v) for v in group_key if v)
                html_parts.append(
                    f'<tr class="group-header-row"><td colspan="{len(columns)}">{group_label}</td></tr>'
                )
            cells = []
            for col in columns:
                value = row.get(col['path'].replace('.', '__'))
                formatted = self.format_value(value, col)
                alignment = col.get('alignment', 'left')
                cells.append(f'<td class="align-{alignment}">{formatted}</td>')
            html_parts.append(f'<tr>{"".join(cells)}</tr>')
        return '\n'.join(html_parts)

    def _render_aggregation_footer(self, columns, aggregations, theme) -> str:
        if not aggregations:
            return ''

        cells = []
        for i, col in enumerate(columns):
            alias = col['path'].lower().replace(' ', '_').replace('-', '_')
            if i == 0:
                cells.append(f'<td><strong>TOTALS</strong></td>')
            elif alias in aggregations:
                val = aggregations[alias]
                formatted = self.format_value(val, col)
                cells.append(f'<td class="align-right"><strong>{formatted}</strong></td>')
            else:
                cells.append('<td></td>')

        return f"""
<table class="report-table" style="border-top: none;">
<tbody>
<tr class="total-row">{''.join(cells)}</tr>
</tbody>
</table>"""

    def _build_filter_summary(self) -> str:
        filters = self.definition.get('filters')
        if not filters or not filters.get('conditions'):
            return ''

        parts = []
        for cond in filters.get('conditions', []):
            path = cond.get('path', '')
            op = cond.get('operator', '')
            value = cond.get('value', '')
            label = path.replace('__', ' → ').replace('_', ' ').title()
            parts.append(f"<strong>{label}</strong> {op} <em>{value}</em>")

        if not parts:
            return ''

        return f'<div class="filter-summary">Filters: {" &nbsp;|&nbsp; ".join(parts)}</div>'
