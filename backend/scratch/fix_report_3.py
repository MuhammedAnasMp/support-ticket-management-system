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

# Test 1: With filter tickets__ticket_id IS NOT NULL
def_with_filter = dict(r.definition)
def_with_filter['filters'] = {
    'logic': 'AND',
    'conditions': [
        {'path': 'tickets__ticket_id', 'operator': 'is_not_null', 'value': ''}
    ]
}

res = execute_report(r.data_source, def_with_filter, user)
rows = res.get('rows', [])
print(f"Rows count with 'tickets__ticket_id IS NOT NULL' filter: {len(rows)}")

empty_count = sum(1 for row in rows if row.get('tickets__ticket_id') is None)
print(f"Empty rows count after filter: {empty_count}")
