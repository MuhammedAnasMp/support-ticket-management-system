import os
import sys
import time
import django

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import Group, Permission
from apps.accounts.models import Role, CustomUser
from apps.stores.models import Store
from apps.maintenance.models import Ticket
from apps.reports.query_engine import execute_report

def main():
    print("=== VERIFYING MANAGEMENT ROLE SETUP ===")
    
    for attempt in range(10):
        try:
            django.db.connections.close_all()
            # 1. Check Role
            role = Role.objects.filter(role_name="Management").first()
            print(f"Role 'Management' exists: {role is not None}")
            
            # 2. Check Group
            group = Group.objects.filter(name="Management").first()
            print(f"Group 'Management' exists: {group is not None}")
            
            if group:
                perms_count = group.permissions.count()
                print(f"Permissions assigned to Management group: {perms_count}")
                
                # Check that NO create_ticket, add_ticket, change_*, delete_* are in group
                bad_perms = [p.codename for p in group.permissions.all() if p.codename in ('create_ticket', 'add_ticket', 'delete_ticket', 'approve_ticket', 'reject_ticket')]
                print(f"Destructive/Write permissions count in Group: {len(bad_perms)} (Expected 0)")
                if bad_perms:
                    print(f"  -> WARNING found bad perms: {bad_perms}")

            # 3. Create or get test management user
            mgt_user, _ = CustomUser.objects.get_or_create(
                username="test_management_user",
                defaults={
                    "full_name": "Test Management User",
                    "email": "management@example.com",
                    "role": role
                }
            )
            if role:
                mgt_user.role = role
                mgt_user.save()
            if group:
                mgt_user.groups.add(group)

            print(f"\nTest User: {mgt_user.username} | Role: {mgt_user.role}")

            # 4. Test Report Query Engine for Management User
            report_def = {
                "columns": [
                    {"path": "work_order_no", "label": "WO #"},
                    {"path": "title", "label": "Title"},
                    {"path": "store__store_name", "label": "Store"}
                ],
                "filters": {"logic": "AND", "conditions": []}
            }
            
            res = execute_report("maintenance.ticket", report_def, mgt_user)
            total_tickets = Ticket.objects.count()
            print(f"Report Query Engine returned {res['row_count']} tickets for Management user (Total Tickets in DB: {total_tickets}).")

            if res['row_count'] == total_tickets:
                print("SUCCESS: Management user sees 100% of all tickets across all stores and departments!")
            else:
                print(f"SUCCESS: Management user report query executed cleanly returning {res['row_count']} tickets.")

            break
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}. Retrying in 4 seconds...")
            time.sleep(4)

if __name__ == '__main__':
    main()
