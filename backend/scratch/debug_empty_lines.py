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

reports = ReportDefinition.objects.all()
print(f"Total saved ReportDefinitions in DB: {reports.count()}", flush=True)

for r in reports:
    print(f"\n--- ID: {r.report_id} | Name: '{r.name}' | Source: '{r.data_source}' ---", flush=True)
    print("Definition:", r.definition, flush=True)

    try:
        res = execute_report(r.data_source, r.definition, user)
        rows = res.get('rows', [])
        cols = res.get('columns', [])
        print(f"Executed rows: {len(rows)}, cols: {len(cols)}")
        if rows:
            first_row = rows[0]
            print("First row sample:", first_row)
            empty_keys = [c['path'] for c in cols if first_row.get(c['path']) is None or first_row.get(c['path']) == '']
            if empty_keys:
                print("Empty/Blank column keys in first row:", empty_keys)
    except Exception as e:
        import traceback
        print("Execution failed:", e)
        traceback.print_exc()
