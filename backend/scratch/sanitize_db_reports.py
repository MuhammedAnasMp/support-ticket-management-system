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

print("Inspecting and sanitizing all ReportDefinition records in DB...", flush=True)

reports = ReportDefinition.objects.all()

for r in reports:
    print(f"\nReport #{r.report_id} - '{r.name}'", flush=True)
    definition = r.definition or {}
    filters = definition.get('filters', {})
    conditions = filters.get('conditions', [])

    clean_conditions = []
    has_changed = False

    for cond in conditions:
        op = cond.get('operator', 'equals')
        val = cond.get('value')
        if op not in ('is_null', 'is_not_null') and (val is None or (isinstance(val, str) and val.strip() == '')):
            print(f"  -> Removing invalid empty filter condition: path='{cond.get('path')}', op='{op}', val='{val}'")
            has_changed = True
        else:
            clean_conditions.append(cond)

    if has_changed:
        definition['filters']['conditions'] = clean_conditions
        r.definition = definition
        r.save(update_fields=['definition'])
        print(f"  -> Successfully updated and sanitized Report #{r.report_id} definition!")
    else:
        print("  -> Definition is clean.")

    # Now attempt execution to verify
    try:
        res = execute_report(r.data_source, r.definition, user)
        print(f"  -> Verification: SUCCESS! Returned {len(res.get('rows', []))} rows.")
    except Exception as e:
        print(f"  -> Verification FAILED for Report #{r.report_id}: {e}")
