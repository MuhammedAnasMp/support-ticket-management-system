import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.reports.query_engine import execute_report

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()

print("Testing Grouped Query Execution...", flush=True)

definition = {
    "columns": [
        {"path": "department__department_name", "label": "Department Name"},
        {"path": "status__status_name", "label": "Status"},
        {"path": "ticket_id", "label": "Ticket ID"},
    ],
    "filters": {"logic": "AND", "conditions": []},
    "grouping": {
        "fields": ["department__department_name"],
        "aggregations": [
            {"path": "ticket_id", "function": "count", "label": "Total Ticket Count"}
        ]
    }
}

try:
    res = execute_report("maintenance.ticket", definition, user)
    print("SUCCESS! Grouped query executed:", flush=True)
    print("  Is Grouped:", res.get('is_grouped'))
    print("  Columns:", res.get('columns'))
    print("  Rows count:", len(res.get('rows', [])))
    if res.get('rows'):
        print("  First Row Sample:", res['rows'][0])
except Exception as e:
    import traceback
    print("FAILED WITH TRACEBACK:", flush=True)
    traceback.print_exc()
