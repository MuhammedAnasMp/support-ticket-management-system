import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.reports.query_engine import execute_report
from apps.reports.renderers.pdf_renderer import PdfRenderer

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()

print("Testing edge case definition with None width and None chart values...", flush=True)

test_def = {
    "columns": [
        {"path": "worklog_id", "label": "Log ID", "width": None},
        {"path": "hours", "label": "Hours", "width": None},
        {"path": "hourly_rate", "label": "Rate", "width": None},
    ],
    "filters": {"logic": "AND", "conditions": []},
    "sorting": [],
    "aggregations": [{"path": "hours", "function": "sum"}],
    "kpi_cards": [{"path": "hours", "function": "sum", "label": "Total Hours"}],
    "charts": [{
        "type": "bar",
        "title": "Hours by Tech",
        "group_by": "worker__username",
        "aggregate_func": "sum",
        "aggregate_field": "hours",
    }]
}

report_data = execute_report("maintenance.worklog", test_def, user, export_format='pdf')
metadata = {
    'name': 'Edge Case Test Report',
    'description': 'Testing null widths and null chart values',
    'theme': 'corporate_blue',
    'page_orientation': 'portrait',
    'page_size': 'A4',
}

renderer = PdfRenderer(report_data, test_def, metadata)
pdf_bytes = renderer.render()
print("SUCCESS! Rendered PDF size:", len(pdf_bytes), "bytes!")
