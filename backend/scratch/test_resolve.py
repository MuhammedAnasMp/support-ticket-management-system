import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.maintenance.models import Ticket
from apps.reports.query_engine import _resolve_path

ticket = Ticket.objects.first()
print("Ticket:", ticket)

paths = [
    "work_order_no",
    "title",
    "store__store_name",
    "department__department_name",
    "nature__nature_name",
    "priority__priority_name",
    "status__status_name",
    "allocations__worker__username",
    "created_by__username",
    "created_date",
]

for p in paths:
    print(f"Resolving '{p}'...", end="", flush=True)
    val = _resolve_path(ticket, p)
    print(f" -> {val}")
