import os
import sys
import time
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.maintenance.models import Ticket
from django.db.models import Count

t0 = time.time()
print("Running values annotate query...", flush=True)
qs = Ticket.objects.values('status__status_name').annotate(chart_val=Count('status__status_name')).order_by('-chart_val')[:10]
data = list(qs)
t1 = time.time()
print(f"DONE in {t1-t0:.3f}s! Data: {data}", flush=True)

from apps.reports.chart_engine import generate_chart_image
print("Generating chart image...", flush=True)
img = generate_chart_image('pie', 'Ticket Status Distribution', [d['status__status_name'] for d in data], [d['chart_val'] for d in data])
t2 = time.time()
print(f"Chart image DONE in {t2-t1:.3f}s! Image length: {len(img) if img else 0}", flush=True)
