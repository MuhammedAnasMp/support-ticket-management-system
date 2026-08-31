import os
import sys
import django

import matplotlib
matplotlib.use('Agg')

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.reports.models import ReportDefinition
from apps.reports.query_engine import ReportQueryEngine, _extract_rows
from apps.accounts.models import CustomUser

user = CustomUser.objects.filter(is_superuser=True).first()

r = ReportDefinition.objects.filter(name__icontains="Worker Labor Hours").first()
print(f"Loaded Report ID: {r.report_id}", flush=True)

engine = ReportQueryEngine(r.data_source, r.definition, user)
qs, column_paths, is_grouped, duration_ms = engine.build_queryset()

print(f"Build QuerySet completed in {duration_ms}ms. Total rows in QS: {qs.count()}", flush=True)
print("Columns:", [c['path'] for c in r.definition['columns']])

print("Extracting rows...", flush=True)
rows = _extract_rows(qs, r.definition['columns'])
print(f"Extracted {len(rows)} rows successfully!", flush=True)
