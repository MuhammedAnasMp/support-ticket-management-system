import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.reports.query_engine import execute_report
from apps.reports.renderers.pdf_renderer import PdfRenderer
from apps.reports.templates_registry import get_prebuilt_templates

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()
templates = get_prebuilt_templates()
tpl = templates[0]

print("STEP 1: Executing report query engine...", flush=True)
report_data = execute_report(tpl['data_source'], tpl['definition'], user)
print(f"STEP 1 DONE! Rows: {report_data['row_count']}, Charts: {len(report_data.get('charts', []))}", flush=True)

metadata = {
    'name': tpl['name'],
    'description': tpl['description'],
    'theme': tpl['theme'],
    'page_orientation': tpl['page_orientation'],
    'page_size': tpl['page_size'],
}

print("STEP 2: Initializing PdfRenderer...", flush=True)
renderer = PdfRenderer(report_data, tpl['definition'], metadata)

print("STEP 3: Calling renderer.render()...", flush=True)
try:
    pdf_bytes = renderer.render()
    print(f"STEP 3 DONE! PDF size: {len(pdf_bytes)} bytes", flush=True)
except Exception as e:
    import traceback
    print("PDF RENDER FAILED WITH EXCEPTION:", flush=True)
    traceback.print_exc()
