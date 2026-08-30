import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.reports.query_engine import execute_report
from apps.reports.renderers.pdf_renderer import PdfRenderer
from apps.reports.renderers.html_renderer import HtmlRenderer
from apps.reports.renderers.excel_renderer import ExcelRenderer
from apps.reports.renderers.csv_renderer import CsvRenderer
from apps.reports.registry import registry

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()

print("Testing all data sources with scalar fields for PDF/Excel/CSV export...", flush=True)

for key in registry._registry.keys():
    rm = registry.get(key)
    # Pick first 5 scalar (non-relation) fields
    scalar_fields = [f for f in registry.get_field_tree(key) if f.get('type') != 'relation'][:5]
    if not scalar_fields:
        scalar_fields = registry.get_field_tree(key)[:3]

    definition = {
        "columns": [{"path": f['path'], "label": f['label']} for f in scalar_fields],
        "filters": {"logic": "AND", "conditions": []},
        "sorting": [],
        "aggregations": [],
    }

    try:
        report_data = execute_report(key, definition, user, export_format='pdf')
        metadata = {
            'name': f"Report for {rm.label}",
            'description': '',
            'theme': 'corporate_blue',
            'page_orientation': 'portrait',
            'page_size': 'A4',
        }

        h_ren = HtmlRenderer(report_data, definition, metadata)
        h_html = h_ren.render()

        p_ren = PdfRenderer(report_data, definition, metadata)
        p_pdf = p_ren.render()

        e_ren = ExcelRenderer(report_data, definition, metadata)
        e_xls = e_ren.render()

        c_ren = CsvRenderer(report_data, definition, metadata)
        c_csv = c_ren.render()

        print(f"  OK! {key}: Rows: {report_data['row_count']}, PDF size: {len(p_pdf)} bytes", flush=True)
    except Exception as e:
        import traceback
        print(f"  FAILED FOR {key}:", flush=True)
        traceback.print_exc()
