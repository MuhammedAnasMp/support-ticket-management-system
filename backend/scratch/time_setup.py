import os
import sys
import time

t0 = time.time()
print("1. Importing django...", flush=True)
import django

print("2. Setting DJANGO_SETTINGS_MODULE...", flush=True)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

t1 = time.time()
print(f"3. Running django.setup() (took {t1-t0:.3f}s so far)...", flush=True)
django.setup()

t2 = time.time()
print(f"4. django.setup() DONE in {t2-t1:.3f}s!", flush=True)

from apps.accounts.models import CustomUser
t3 = time.time()
print(f"5. CustomUser import DONE in {t3-t2:.3f}s!", flush=True)
