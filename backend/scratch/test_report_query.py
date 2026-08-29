import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.reports.query_engine import execute_report

user = CustomUser.objects.filter(is_superuser=True).first()
if not user:
    user = CustomUser.objects.first()

definition = {
    "columns": [
        {"path": "work_order_no", "label": "WO#"},
        {"path": "title", "label": "Title"},
        {"path": "store__store_name", "label": "Store"},
        {"path": "allocations__worker__username", "label": "Assigned Worker"},
    ],
    "filters": {"logic": "AND", "conditions": []},
    "sorting": [{"path": "created_date", "direction": "desc"}],
}

print(f"Testing execute_report for Ticket data source with user: {user}...")

try:
    result = execute_report("maintenance.ticket", definition, user)
    print("SUCCESS!")
    print(f"Row count: {result['row_count']}")
    print(f"Duration: {result['duration_ms']} ms")
    if result['rows']:
        print("Sample row:", result['rows'][0])
except Exception as e:
    import traceback
    print("FAILED WITH ERROR:")
    traceback.print_exc()
