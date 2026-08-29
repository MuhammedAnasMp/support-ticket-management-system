import os
import sys
import time
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

t0 = time.time()
print("Executing report...", flush=True)
report_data = execute_report(tpl['data_source'], tpl['definition'], user, export_format='pdf')
t1 = time.time()
print(f"execute_report DONE in {t1-t0:.3f}s! Rows: {report_data['row_count']}", flush=True)

metadata = {
    'name': tpl['name'],
    'description': tpl['description'],
    'theme': tpl['theme'],
    'page_orientation': tpl['page_orientation'],
    'page_size': tpl['page_size'],
}

renderer = PdfRenderer(report_data, tpl['definition'], metadata)
pdf_bytes = renderer.render()
t2 = time.time()
print(f"PdfRenderer.render() DONE in {t2-t1:.3f}s! PDF size: {len(pdf_bytes)} bytes", flush=True)
