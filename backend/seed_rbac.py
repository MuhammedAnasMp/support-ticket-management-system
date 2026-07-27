import os
import django
import sys
from decimal import Decimal
import datetime

sys.path.append(r'E:\Code\Maintenancde Tracker\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import Group, Permission
from apps.accounts.models import Role, CustomUser, WhatsAppLog, PasswordResetOTP
from apps.stores.models import Store, Department, SubDepartment, Area
from apps.maintenance.models import Priority, Status, WorkNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory
from apps.finance.models import ExpenseType, EmployeeRate, Expense, Reconciliation
from apps.common.models import MediaCategory, Media, Notification


def seed():
    print("Cleaning database...")
    # Delete in correct order to prevent foreign key constraint failures
    Reconciliation.objects.all().delete()
    Expense.objects.all().delete()
    WorkLog.objects.all().delete()
    Allocation.objects.all().delete()
    TicketHistory.objects.all().delete()
    Ticket.objects.all().delete()
    NatureWorker.objects.all().delete()
    WorkNature.objects.all().delete()
    Status.objects.all().delete()
    Priority.objects.all().delete()
    EmployeeRate.objects.all().delete()
    WhatsAppLog.objects.all().delete()
    PasswordResetOTP.objects.all().delete()
    Notification.objects.all().delete()
    Media.objects.all().delete()
    MediaCategory.objects.all().delete()
    ExpenseType.objects.all().delete()

    # Delete users
    CustomUser.objects.all().delete()

    # Delete stores
    Store.objects.all().delete()
    SubDepartment.objects.all().delete()
    Department.objects.all().delete()
    Area.objects.all().delete()
    Role.objects.all().delete()

    # Clean Django Groups
    Group.objects.all().delete()

    print("Database cleaned.")

    # 1. Create Roles
    admin_role = Role.objects.create(role_name="Main Administrator")
    office_role = Role.objects.create(role_name="Office Administrator")
    manager_role = Role.objects.create(role_name="Store Manager")
    area_role = Role.objects.create(role_name="Area Manager")
    worker_role = Role.objects.create(role_name="Technician")
    print("Roles created.")

    # 2. Create Django Groups corresponding to Roles
    admin_group = Group.objects.create(name="admin")
    office_group = Group.objects.create(name="office_admin")
    manager_group = Group.objects.create(name="store_manager")
    area_group = Group.objects.create(name="area_manager")
    worker_group = Group.objects.create(name="technician")
    print("Django groups created.")

    # Assign all permissions to Admin group
    all_perms = Permission.objects.all()
    admin_group.permissions.set(all_perms)

    # Define permissions for Office Admin
    office_perms = [
        p for p in all_perms
        if p.content_type.app_label in ['accounts', 'stores', 'maintenance', 'finance', 'common']
    ]
    office_group.permissions.set(office_perms)

    # Define permissions for Store Manager
    manager_perm_codenames = [
        'view_ticket', 'add_ticket', 'change_ticket',
        'view_store', 'view_department', 'view_subdepartment', 'view_priority', 'view_status', 'view_worknature',
        'view_customuser', 'view_allocation', 'view_worklog', 'view_expense', 'view_reconciliation'
    ]
    manager_perms = [
        p for p in all_perms if p.codename in manager_perm_codenames]
    manager_group.permissions.set(manager_perms)

    # Define permissions for Area Manager (same as store manager for their stores)
    area_perms = manager_perms
    area_group.permissions.set(area_perms)

    # Define permissions for Workers
    worker_perm_codenames = [
        'view_ticket', 'view_store', 'view_department', 'view_subdepartment', 'view_priority', 'view_status', 'view_worknature',
        'view_allocation', 'add_worklog', 'view_worklog', 'add_expense', 'view_expense', 'view_employeerate'
    ]
    worker_perms = [
        p for p in all_perms if p.codename in worker_perm_codenames]
    worker_group.permissions.set(worker_perms)
    print("Permissions mapped to groups.")

    # 3. Create Areas and 10 Stores
    capital_area = Area.objects.create(area_name="Capital Area")
    farwaniya_area = Area.objects.create(area_name="Farwaniya Area")
    hawally_area = Area.objects.create(area_name="Hawally Area")

    stores = []
    for i in range(1, 11):
        if i <= 5:
            area = capital_area
        elif i <= 8:
            area = farwaniya_area
        else:
            area = hawally_area

        store = Store.objects.create(
            store_id=f"S{i:02d}",
            store_name=f"Grand Hypermarket Store-{i:02d}",
            area=area,
            address=f"Location Address of Store {i}",
            phone=f"900000{i:02d}",
            whatsapp_number=f"900000{i:02d}",
            active=True
        )
        stores.append(store)

    print(f"Created 10 stores.")

    # 4. Create Departments & Sub-departments
    dept_it = Department.objects.create(
        department_name="Information Technology")
    dept_maint = Department.objects.create(department_name="Maintenance")

    sub_soft = SubDepartment.objects.create(
        department=dept_it, sub_department_name="Software Systems")
    sub_elec = SubDepartment.objects.create(
        department=dept_maint, sub_department_name="Electrical Works")
    sub_plumb = SubDepartment.objects.create(
        department=dept_maint, sub_department_name="Plumbing Works")

    # Work Nature
    p_critical = Priority.objects.create(
        department=dept_maint, priority_name="Critical", level=1)
    p_high = Priority.objects.create(
        department=dept_maint, priority_name="High", level=2)

    Status.objects.create(department=dept_maint, status_name="Open")
    Status.objects.create(department=dept_maint, status_name="In Progress")
    Status.objects.create(department=dept_maint, status_name="Completed")
    Status.objects.create(department=dept_maint, status_name="Reconciled")

    sk_db = WorkNature.objects.create(
        nature_name="Database Tuning", sub_department=sub_soft, default_priority=p_high)
    sk_elec = WorkNature.objects.create(
        nature_name="AC Repair", sub_department=sub_elec, default_priority=p_critical)
    sk_plumb = WorkNature.objects.create(
        nature_name="Leak Fix", sub_department=sub_plumb, default_priority=p_high)

    # 5. Create Users
    # 5.1 MainAdmin
    admin_user = CustomUser.objects.create_superuser(
        username="999",
        email="admin@hypermarket.com",
        full_name="Main Administrator",
        employee_no="EMP-0001",
        role=admin_role,
        active=True
    )
    admin_user.set_password("123")
    admin_user.save()
    admin_user.groups.add(admin_group)
    admin_user.accessible_stores.set(stores)
    print("MainAdmin created.")

    # 5.2 Rahees (Office Administrator)
    rahees_user = CustomUser.objects.create_user(
        username="888",
        email="rahees.office@hypermarket.com",
        full_name="Rahees Office Admin",
        employee_no="EMP-0002",
        role=office_role,
        active=True
    )
    rahees_user.set_password("123")
    rahees_user.save()
    rahees_user.groups.add(office_group)
    rahees_user.accessible_stores.set(stores)
    rahees_user.sub_departments.add(sub_elec)
    print("Rahees Office Admin created.")

    # 5.3 Aziz (Store Manager for Store 1)
    aziz_user = CustomUser.objects.create_user(
        username="666",
        email="aziz.manager@hypermarket.com",
        full_name="Aziz Store Manager",
        employee_no="EMP-1001",
        role=manager_role,
        store=stores[0],
        active=True
    )
    aziz_user.set_password("123")
    aziz_user.save()
    aziz_user.groups.add(manager_group)
    aziz_user.accessible_stores.add(stores[0])
    # Hook Store Model manager reference
    stores[0].manager = aziz_user
    stores[0].save()
    print("Aziz Store Manager created.")

    # 5.4 GV (Area Manager for Stores 1 to 5)
    gv_user = CustomUser.objects.create_user(
        username="777",
        email="gv.area@hypermarket.com",
        full_name="GV Area Manager",
        employee_no="EMP-2001",
        role=area_role,
        active=True
    )
    gv_user.set_password("123")
    gv_user.save()
    gv_user.groups.add(area_group)
    gv_user.accessible_stores.set(stores[0:5])
    print("GV Area Manager created.")

    # 5.5 Create 5 workers managed by Rahees
    worker_names = ["101", "102", "103", "104", "105"]
    for idx, name in enumerate(worker_names):
        worker = CustomUser.objects.create_user(
            username=name.lower(),
            email=f"{name.lower()}@hypermarket.com",
            full_name=f"{name} Worker",
            employee_no=f"100{idx+1}",
            role=worker_role,
            store=stores[idx],
            active=True
        )
        worker.set_password(f"123")
        worker.save()
        worker.groups.add(worker_group)
        worker.accessible_stores.add(stores[idx])

        # Add to sub-departments and skills
        if idx % 2 == 0:
            worker.sub_departments.add(sub_elec)
            NatureWorker.objects.create(worker=worker, nature=sk_elec)
        else:
            worker.sub_departments.add(sub_plumb)
            NatureWorker.objects.create(worker=worker, nature=sk_plumb)

        EmployeeRate.objects.create(
            worker=worker,
            hourly_rate=Decimal("15.00") + Decimal(idx * 2),
            effective_from=datetime.date.today()
        )
        print(f"Worker {name} created and assigned to store {idx+1}.")

    print("Seeding completed successfully!")


if __name__ == '__main__':
    seed()
