import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser
from apps.maintenance.models import Ticket

user = CustomUser.objects.filter(username__iexact='JAMSHAD').first()
if user:
    print(f"User: {user.username}")
    for t in Ticket.objects.filter(department_id=2):
        print(f"Ticket #{t.work_order_no} | Created Date: {t.created_date} | Dept: {t.department}")

print("\n--- ALL RECENT TICKETS IN DB (first 10) ---")
for t in Ticket.objects.all().order_by('-created_date')[:10]:
    print(f"Ticket #{t.work_order_no} | Created Date: {t.created_date} | Dept: {t.department.department_name} (ID: {t.department_id})")
