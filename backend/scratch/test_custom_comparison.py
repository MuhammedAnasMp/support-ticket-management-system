import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.reports.query_engine import execute_report

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()

print("Testing Custom Date Range Comparison...", flush=True)

definition = {
    "columns": [
        {"path": "ticket_id", "label": "Ticket ID"},
        {"path": "created_date", "label": "Created Date"},
        {"path": "total_cost", "label": "Total Cost"},
    ],
    "filters": {"logic": "AND", "conditions": []},
    "comparison": {
        "enabled": True,
        "type": "custom",
        "date_field": "created_date",
        "custom_period_a": ["2026-08-01", "2026-08-31"],
        "custom_period_b": ["2026-07-01", "2026-07-31"],
    },
    "kpi_cards": [
        {"path": "ticket_id", "function": "count", "label": "Total Tickets"},
    ]
}

try:
    res = execute_report("maintenance.ticket", definition, user)
    print("SUCCESS! Custom Comparison query executed:", flush=True)
    cards = res.get('kpi_cards', [])
    print(f"  KPI Cards count: {len(cards)}")
    for card in cards:
        print("  Card:", card)
except Exception as e:
    import traceback
    print("FAILED WITH TRACEBACK:", flush=True)
    traceback.print_exc()
