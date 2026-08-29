import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.reports.query_engine import ReportQueryEngine
from apps.reports.templates_registry import get_prebuilt_templates

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()
templates = get_prebuilt_templates()
tpl = templates[0]

print("1. Initializing engine...", flush=True)
engine = ReportQueryEngine(tpl['data_source'], tpl['definition'], user)

print("2. Building queryset...", flush=True)
qs, column_paths, is_grouped, duration_ms = engine.build_queryset()

print("3. Fetching rows...", flush=True)
from apps.reports.query_engine import _extract_rows
rows = _extract_rows(qs, tpl['definition']['columns'])
print(f"3 DONE! Extracted {len(rows)} rows.", flush=True)

print("4. Calculating charts...", flush=True)
from apps.reports.chart_engine import generate_chart_image
print("4 DONE! Chart engine import successful.", flush=True)
