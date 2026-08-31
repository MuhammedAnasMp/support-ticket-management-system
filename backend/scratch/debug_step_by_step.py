import os
import sys
import django

import matplotlib
matplotlib.use('Agg')

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.reports.models import ReportDefinition
from apps.reports.query_engine import execute_report
from apps.accounts.models import CustomUser

user = CustomUser.objects.filter(is_superuser=True).first()

r = ReportDefinition.objects.filter(name__icontains="Worker Labor Hours").first()
print(f"Loaded Report ID: {r.report_id}", flush=True)

res = execute_report(r.data_source, r.definition, user)
print("SUCCESSFULLY EXECUTED execute_report!", flush=True)
print("Rows count:", len(res.get('rows', [])))
print("KPI cards:", res.get('kpi_cards'))
print("Charts count:", len(res.get('charts', [])))
