import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.reports.models import ReportDefinition
from apps.reports.query_engine import execute_report
from apps.accounts.models import CustomUser

user = CustomUser.objects.filter(is_superuser=True).first()

r = ReportDefinition.objects.get(report_id=3)
res = execute_report(r.data_source, r.definition, user)

rows = res.get('rows', [])
print(f"Total rows in 'New Custom Report test': {len(rows)}")

empty_rows = []
for idx, row in enumerate(rows):
    # Check if key fields like tickets__ticket_id or tickets__work_order_no are None
    if row.get('tickets__ticket_id') is None:
        empty_rows.append((idx, row))

print(f"Number of rows where 'tickets__ticket_id' is None (Empty lines): {len(empty_rows)}")

if empty_rows:
    print("\nSample Empty Rows:")
    for idx, er in empty_rows[:5]:
        print(f"Row #{idx}: {er}")
