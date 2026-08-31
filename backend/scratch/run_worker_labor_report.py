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

print("Fetching 'Worker Labor Hours & Costs' report...", flush=True)

try:
    r = ReportDefinition.objects.filter(name__icontains="Worker Labor Hours").first()
    if not r:
        print("Report not found in DB!")
    else:
        print(f"Executing Report ID: {r.report_id} | Name: '{r.name}'", flush=True)
        res = execute_report(r.data_source, r.definition, user)
        print("SUCCESSFULLY EXECUTED REPORT!", flush=True)
        print("Rows count:", len(res.get('rows', [])))
        print("Charts count:", len(res.get('charts', [])))
        print("KPI cards count:", len(res.get('kpi_cards', [])))
        if res.get('kpi_cards'):
            print("First KPI Card:", res['kpi_cards'][0])
except Exception as e:
    import traceback
    print("EXECUTION FAILED WITH EXCEPTION:", flush=True)
    traceback.print_exc()
