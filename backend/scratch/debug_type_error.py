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

for tpl in templates:
    if tpl['id'] == 'tpl_worker_hours':
        print(f"Testing {tpl['name']}...", flush=True)
        try:
            report_data = execute_report(tpl['data_source'], tpl['definition'], user, export_format='pdf')
            metadata = {
                'name': tpl['name'],
                'description': tpl['description'],
                'theme': tpl['theme'],
                'page_orientation': tpl['page_orientation'],
                'page_size': tpl['page_size'],
            }
            renderer = PdfRenderer(report_data, tpl['definition'], metadata)
            pdf_bytes = renderer.render()
            print("SUCCESS! PDF size:", len(pdf_bytes))
        except Exception as e:
            import traceback
            print("FAILED WITH TRACEBACK:")
            traceback.print_exc()
