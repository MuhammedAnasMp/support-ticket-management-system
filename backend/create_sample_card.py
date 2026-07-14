import os
import django
import datetime
from decimal import Decimal
from django.utils import timezone
from django.core.files.base import ContentFile

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.stores.models import Store, Department, SubDepartment
from apps.accounts.models import Role, CustomUser
from apps.maintenance.models import Priority, Status, MaintenanceNature, Ticket, Allocation, WorkLog, TicketHistory
from apps.finance.models import ExpenseType, EmployeeRate, Expense, Reconciliation
from apps.common.models import MediaCategory, Media

def run_sample_flow():
    print("--- Starting Sample Card (Ticket) End-to-End Flow ---")

    # 1. Create Store & Department
    store, _ = Store.objects.get_or_create(
        store_name="Hypermarket Store-001",
        address="123 Main Street",
        phone="87654321",
        whatsapp_number="9876543210",
        active=True
    )
    print(f"1. Store created: {store}")

    department, _ = Department.objects.get_or_create(
        department_name="Information Technology"
    )
    print(f"2. Department created: {department}")

    # 2. Create Sub-Department
    sub_dept, _ = SubDepartment.objects.get_or_create(
        department=department,
        sub_department_name="Software Systems"
    )
    print(f"3. Sub-Department created: {sub_dept}")

    # 3. Create Roles
    role_office, _ = Role.objects.get_or_create(role_name="Office Staff")
    role_manager, _ = Role.objects.get_or_create(role_name="Store Manager")
    role_worker, _ = Role.objects.get_or_create(role_name="Technician")
    print("4. Roles created: Office Staff, Store Manager, Technician")

    # 4. Create Users
    manager_user, created = CustomUser.objects.get_or_create(
        username="manager_john",
        defaults={
            "email": "john.manager@hypermarket.com",
            "full_name": "John Manager",
            "role": role_manager,
            "store": store,
            "employee_no": "EMP-1002"
        }
    )
    if created:
        manager_user.set_password("Manager123!")
        manager_user.save()

    worker_user, created = CustomUser.objects.get_or_create(
        username="worker_bob",
        defaults={
            "email": "bob.worker@hypermarket.com",
            "full_name": "Bob Worker",
            "role": role_worker,
            "store": store,
            "employee_no": "EMP-5008"
        }
    )
    if created:
        worker_user.set_password("Worker123!")
        worker_user.save()
    # Add worker to Software Systems sub-department
    worker_user.sub_departments.add(sub_dept)

    office_user, created = CustomUser.objects.get_or_create(
        username="office_alice",
        defaults={
            "email": "alice.office@hypermarket.com",
            "full_name": "Alice Office",
            "role": role_office,
            "employee_no": "EMP-0001"
        }
    )
    if created:
        office_user.set_password("Office123!")
        office_user.save()
    # Office has access to all stores
    office_user.accessible_stores.add(store)

    print(f"5. Users created: {manager_user.full_name} (Manager), {worker_user.full_name} (Worker), {office_user.full_name} (Office)")

    # 5. Create Priorities & Statuses
    priority_high, _ = Priority.objects.get_or_create(priority_name="High", defaults={"level": 2})
    status_open, _ = Status.objects.get_or_create(status_name="Open")
    status_progress, _ = Status.objects.get_or_create(status_name="In Progress")
    status_completed, _ = Status.objects.get_or_create(status_name="Completed")
    status_reconciled, _ = Status.objects.get_or_create(status_name="Reconciled")
    print("6. Priorities and Statuses set up.")

    # 6. Create Maintenance Nature
    nature, _ = MaintenanceNature.objects.get_or_create(
        nature_name="Database Performance Lag",
        sub_department=sub_dept,
        default_priority=priority_high,
        active=True
    )
    print(f"7. Maintenance Nature created: {nature}")

    # 7. Create Employee Rate
    worker_rate, _ = EmployeeRate.objects.get_or_create(
        worker=worker_user,
        hourly_rate=Decimal("25.00"),
        effective_from=datetime.date(2026, 1, 1)
    )
    print(f"8. Worker Hourly Rate set: {worker_rate.hourly_rate} USD/hour")

    # 8. Create Ticket (Work Order)
    ticket, _ = Ticket.objects.get_or_create(
        work_order_no="WO-2026-000123",
        defaults={
            "store": store,
            "department": department,
            "nature": nature,
            "priority": priority_high,
            "status": status_open,
            "title": "Main Checkout Database Connection Lagging",
            "description": "The SQL server database is locking connection pools, slowing down checkout lines.",
            "created_by": manager_user
        }
    )
    print(f"9. Ticket Created: {ticket.work_order_no} - '{ticket.title}'")

    # Log Ticket History - Open
    TicketHistory.objects.get_or_create(
        ticket=ticket,
        status=status_open,
        changed_by=manager_user,
        remarks="Ticket raised from checkout floor."
    )

    # 9. Create Allocation (Assigning Worker)
    allocation, _ = Allocation.objects.get_or_create(
        ticket=ticket,
        worker=worker_user,
        defaults={
            "assigned_by": office_user,
            "planned_hours": Decimal("4.00"),
            "remarks": "Please resolve connection pool leaks."
        }
    )
    print(f"10. Work Allocated to: {allocation.worker.username} (Planned Hours: {allocation.planned_hours})")

    # Update Ticket Status to In Progress
    ticket.status = status_progress
    ticket.save()
    TicketHistory.objects.create(
        ticket=ticket,
        status=status_progress,
        changed_by=worker_user,
        remarks="Technician began investigation."
    )
    print(f"11. Ticket Status changed to: {ticket.status.status_name}")

    # 10. Log Work
    work_log, _ = WorkLog.objects.get_or_create(
        ticket=ticket,
        worker=worker_user,
        allocation=allocation,
        work_date=datetime.date.today(),
        defaults={
            "hours": Decimal("3.50"),
            "hourly_rate": worker_rate.hourly_rate,
            "labour_amount": Decimal("3.50") * worker_rate.hourly_rate,
            "work_done": "Cleared pool leaks, updated postgres pool configurations, restarted database server."
        }
    )
    print(f"12. Work logged: {work_log.hours} hours. Labour amount: {work_log.labour_amount} USD")

    # 11. Log Expense (Bills: Bus Fare, Material, etc.)
    expense_type_travel, _ = ExpenseType.objects.get_or_create(expense_name="Bus Fare")
    expense, _ = Expense.objects.get_or_create(
        ticket=ticket,
        worker=worker_user,
        expense_type=expense_type_travel,
        defaults={
            "amount": Decimal("15.50"),
            "expense_date": datetime.date.today(),
            "remarks": "Roundtrip bus ticket to Hypermarket Store-001",
            "approved": True,
            "approved_by": manager_user
        }
    )
    print(f"13. Expense logged: {expense.amount} USD for {expense.expense_type.expense_name} (Approved by Manager)")

    # Ensure fresh media files are written to disk
    Media.objects.filter(ticket=ticket).delete()
    Media.objects.filter(expense=expense).delete()

    # 12. Upload Media (Issue photo & Receipt)
    cat_issue = MediaCategory.objects.get(category_name="Issue Media")
    cat_receipt = MediaCategory.objects.get(category_name="Receipt")

    media_issue, created_issue = Media.objects.get_or_create(
        ticket=ticket,
        uploaded_by=manager_user,
        category=cat_issue,
        defaults={
            "file_name": "database_lag_video.mp4"
        }
    )
    if created_issue:
        media_issue.file_url.save(
            "database_lag_video.mp4",
            ContentFile(b"Mock MP4 video data showing database lag")
        )
        media_issue.save()
    print(f"14. Issue Media attachment: {media_issue.file_name} -> Upload path: {media_issue.file_url.name}")

    media_receipt, created_receipt = Media.objects.get_or_create(
        expense=expense,
        uploaded_by=worker_user,
        category=cat_receipt,
        defaults={
            "file_name": "bus_receipt.png"
        }
    )
    if created_receipt:
        media_receipt.file_url.save(
            "bus_receipt.png",
            ContentFile(b"Mock PNG image data of bus receipt")
        )
        media_receipt.save()
    print(f"15. Expense Receipt attachment: {media_receipt.file_name} -> Upload path: {media_receipt.file_url.name}")


    # Complete Ticket
    ticket.status = status_completed
    ticket.closed_by = office_user
    ticket.closed_date = timezone.now()
    ticket.save()
    TicketHistory.objects.create(
        ticket=ticket,
        status=status_completed,
        changed_by=office_user,
        remarks="Verified fix and closed work order."
    )
    print(f"16. Ticket closed/completed by: {ticket.closed_by.username}")

    # 13. Reconciliation
    recon, _ = Reconciliation.objects.get_or_create(
        ticket=ticket,
        defaults={
            "verified_by": office_user,
            "labour_total": work_log.labour_amount,
            "expense_total": expense.amount,
            "material_total": Decimal("0.00"),
            "grand_total": work_log.labour_amount + expense.amount,
            "remarks": "All logs verified against work order allocation.",
            "completed": True
        }
    )
    print(f"17. Reconciliation finished: Grand Total = {recon.grand_total} USD (Labour: {recon.labour_total}, Expense: {recon.expense_total})")

    # Update Ticket to Reconciled
    ticket.status = status_reconciled
    ticket.save()
    TicketHistory.objects.create(
        ticket=ticket,
        status=status_reconciled,
        changed_by=office_user,
        remarks="Ticket reconciled."
    )
    print(f"18. Ticket Status updated to: {ticket.status.status_name}")
    print("--- End-to-End Flow Completed Successfully ---")

if __name__ == '__main__':
    run_sample_flow()
