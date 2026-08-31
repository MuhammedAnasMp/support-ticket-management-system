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

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()

print("Testing Month-over-Month (MoM) Period Comparison...", flush=True)

definition = {
    "columns": [
        {"path": "ticket_id", "label": "Ticket ID"},
        {"path": "work_order_no", "label": "WO #"},
        {"path": "title", "label": "Title"},
        {"path": "created_date", "label": "Created Date"},
        {"path": "status__status_name", "label": "Status"},
    ],
    "filters": {"logic": "AND", "conditions": []},
    "sorting": [{"path": "created_date", "direction": "desc"}],
    "kpi_cards": [
        {"path": "ticket_id", "function": "count", "label": "Total Tickets", "color": "blue"},
    ],
    "charts": [
        {
            "type": "bar",
            "title": "Tickets by Department",
            "group_by": "department__department_name",
            "aggregate_func": "count",
            "aggregate_field": "ticket_id",
        }
    ],
    "comparison": {
        "enabled": True,
        "type": "previous_month",
        "date_field": "created_date"
    }
}

try:
    report_data = execute_report("maintenance.ticket", definition, user, export_format='pdf')
    print("Report Data Generated Successfully!", flush=True)
    print("  KPI Cards:", report_data.get('kpi_cards'))
    print("  Charts Count:", len(report_data.get('charts', [])))

    metadata = {
        'name': 'Month-over-Month Ticket Comparison Report',
        'description': 'Comparing current month tickets vs previous month',
        'theme': 'corporate_blue',
        'page_orientation': 'portrait',
        'page_size': 'A4',
    }

    h_ren = HtmlRenderer(report_data, definition, metadata)
    html_out = h_ren.render()

    p_ren = PdfRenderer(report_data, definition, metadata)
    pdf_bytes = p_ren.render()

    print(f"SUCCESS! Rendered Comparison PDF Size: {len(pdf_bytes)} bytes!", flush=True)
except Exception as e:
    import traceback
    print("FAILED WITH TRACEBACK:", flush=True)
    traceback.print_exc()
