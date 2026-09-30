import random
from decimal import Decimal
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

from apps.accounts.models import Role
from apps.stores.models import Store, Department, SubDepartment
from apps.maintenance.models import (
    Ticket, Priority, Status, WorkNature, Allocation, WorkLog, TicketHistory, TicketChatMessage
)
from apps.finance.models import (
    Expense, ExpenseType, WorkerClaim, Ledger, ApprovalInstance, Payment, AuditEvent,
    ApprovalWorkflow, ApprovalStep
)
from apps.finance.services import ApprovalService
from apps.common.models import Media, MediaCategory, Notification

User = get_user_model()

PLACEHOLDER_IMAGE = "dark-placeholder.png"


class Command(BaseCommand):
    help = "Clears current ticket & financial data and seeds 20 tickets across 7 stores with unclaimed pending approval expenses for targeted workers."

    def handle(self, *args, **options):
        self.stdout.write(
            "Resetting ticket & financial data and seeding test entries...")

        with transaction.atomic():
            # 1. Clear existing data
            Payment.objects.all().delete()
            ApprovalInstance.objects.all().delete()
            Ledger.objects.all().delete()
            WorkerClaim.objects.all().delete()
            Expense.objects.all().delete()
            WorkLog.objects.all().delete()
            Allocation.objects.all().delete()
            TicketChatMessage.objects.all().delete()
            TicketHistory.objects.all().delete()
            Media.objects.all().delete()
            Notification.objects.all().delete()
            AuditEvent.objects.filter(entity_name__in=[
                                      'Expense', 'WorkerClaim', 'Ledger', 'Payment', 'Ticket']).delete()

            # Raw delete tickets to bypass Ticket.delete() prevention check
            Ticket.objects.all()._raw_delete(Ticket.objects.all().db)

            self.stdout.write(self.style.WARNING(
                "  - Cleared all existing Tickets, Expenses, Claims/Bundles, Ledgers, WorkLogs, and Approvals."))

            # 2. Configure 1-Level Approval Workflows
            roles_def = [
                ("Office Administrator",
                 "Responsible for initial verification of worker expenses"),
                ("Store Manager",
                 "Responsible for reviewing and approving ticket/store expenses"),
                ("Internal Auditor",
                 "Responsible for auditing financial claims and ledger compliance"),
                ("Cash Officer", "Responsible for final payment disbursement and financial settlement"),
                ("Maintenance Worker", "Field maintenance technician")
            ]
            roles = {}
            for role_name, desc in roles_def:
                r, _ = Role.objects.get_or_create(role_name=role_name)
                roles[role_name] = r

            # Enforce 1-level workflow for Bundle, Ledger, and Expense
            workflow_configs = [
                ('Bundle', 'Worker Claim Bundle 1-Level Approval',
                 roles["Office Administrator"]),
                ('Ledger', 'Ledger Batch 1-Level Approval',
                 roles["Cash Officer"]),
                ('Expense', 'Single Expense 1-Level Approval',
                 roles["Office Administrator"]),
            ]

            for entity_type, wf_name, assigned_role in workflow_configs:
                wf, _ = ApprovalWorkflow.objects.get_or_create(
                    entity_type=entity_type,
                    is_active=True,
                    defaults={"name": wf_name}
                )
                wf.name = wf_name
                wf.save()
                # Remove any existing extra steps so it's strictly 1-level
                ApprovalStep.objects.filter(
                    workflow=wf).exclude(step_order=1).delete()
                ApprovalStep.objects.update_or_create(
                    workflow=wf,
                    step_order=1,
                    defaults={
                        "step_name": f"{entity_type} Approval",
                        "assigned_role": assigned_role,
                        "is_final_step": True
                    }
                )

            self.stdout.write(self.style.SUCCESS(
                "  - Configured 1-Level Approval Workflows for Bundle, Ledger, and Expense."))

            # 3. Ensure Maintenance Department & SubDepartment
            dept, _ = Department.objects.get_or_create(
                department_name="Maintenance",
                defaults={"short_code": "MAINT"}
            )

            sub_dept, _ = SubDepartment.objects.get_or_create(
                department=dept,
                sub_department_name="Maintenance"
            )

            # Expense Types with Parent hierarchy
            expense_hierarchy = {
                "Materials & Parts": [
                    "Spare Parts & Materials",
                    "Electrical Supplies",
                    "Plumbing & Sanitation",
                    "Hardware & Locksmith",
                    "General Supplies"
                ],
                "Labor & Maintenance": [
                    "Technician Labor Charges",
                    "HVAC Servicing",
                    "Emergency Repairs"
                ],
                "Travel & Logistics": [
                    "Travel & Transport"
                ],
                "Tools & Equipment": [
                    "Tool Purchase & Equipment"
                ]
            }

            expense_types = []
            for parent_name, sub_names in expense_hierarchy.items():
                parent_et, _ = ExpenseType.objects.get_or_create(
                    department=dept,
                    expense_name=parent_name,
                    defaults={"parent": None, "approve_required": False}
                )
                for sub_name in sub_names:
                    approve_req = random.choice([True, False])
                    sub_et, _ = ExpenseType.objects.get_or_create(
                        department=dept,
                        expense_name=sub_name,
                        defaults={"parent": parent_et,
                                  "approve_required": approve_req}
                    )
                    sub_et.parent = parent_et
                    sub_et.approve_required = approve_req
                    sub_et.save(update_fields=['parent', 'approve_required'])
                    expense_types.append(sub_et)

            # Media Categories
            cat_before, _ = MediaCategory.objects.get_or_create(
                department=dept, category_name="Before Repair")
            cat_after, _ = MediaCategory.objects.get_or_create(
                department=dept, category_name="After Repair")
            cat_receipt, _ = MediaCategory.objects.get_or_create(
                department=dept, category_name="Expense Receipt")

            # 4. Ensure 7 Stores
            store_data = [
                ("STR-101", "HM Store City", "HM"),
                ("STR-102", "Main Street Outlet", "SM"),
                ("STR-103", "North Plaza Branch", "WH"),
                ("STR-104", "Central Mall Store", "CS"),
                ("STR-105", "Westside Hypermarket", "WH2"),
                ("STR-106", "Downtown Express", "DE"),
                ("STR-107", "Airport Terminal Outlet", "AT"),
            ]
            stores = []
            for s_id, s_name, s_code in store_data:
                st, _ = Store.objects.get_or_create(
                    store_id=s_id,
                    defaults={
                        "store_name": s_name,
                        "short_code": s_code
                    }
                )
                stores.append(st)

            # 5. Targeted Workers Selection (usernames: 123, 11111, 10857, 103, 102, 101)
            target_usernames = ["123", "11111", "10857", "103", "102", "101"]
            worker_role = roles["Maintenance Worker"]
            workers = []

            for uname in target_usernames:
                u, created = User.objects.get_or_create(
                    username=uname,
                    defaults={
                        "full_name": f"Worker {uname}",
                        "email": f"worker_{uname}@example.com",
                        "active": True,
                        "role": worker_role
                    }
                )
                if not u.active:
                    u.active = True
                    u.save(update_fields=['active'])
                if created:
                    u.set_password("password123")
                    u.save()
                workers.append(u)

            admin_user = User.objects.filter(
                is_superuser=True).first() or workers[0]

            # 6. Ensure Priorities, WorkNatures, and Statuses
            priority_names = ["Low", "Medium", "High", "Critical"]
            priorities = []
            for idx, p_name in enumerate(priority_names, 1):
                p, _ = Priority.objects.get_or_create(
                    department=dept,
                    priority_name=p_name,
                    defaults={"level": idx}
                )
                priorities.append(p)

            status_names = ["Open", "In Progress", "Location Approval",
                            "Completed", "Reconciled", "Blocked"]
            statuses = []
            for idx, s_name in enumerate(status_names, 1):
                st, _ = Status.objects.get_or_create(
                    status_name=s_name,
                    defaults={"active": True, "order": idx}
                )
                statuses.append(st)

            nature_names = ["General Repair", "Electrical Maintenance",
                            "HVAC Repair", "Plumbing & Piping", "Locksmith Work"]
            natures = []
            for n_name in nature_names:
                n, _ = WorkNature.objects.get_or_create(
                    nature_name=n_name,
                    defaults={"sub_department": sub_dept,
                              "media_required": True, "active": True}
                )
                natures.append(n)

            # 7. Seed 20 New Tickets across 7 stores in random status
            today = date.today()
            tickets = []

            for i in range(1, 21):
                store = stores[i % len(stores)]
                selected_status = random.choice(statuses)
                selected_priority = random.choice(priorities)
                selected_nature = random.choice(natures)
                worker = random.choice(workers)

                ticket = Ticket(
                    work_order_no=f"WO-2026-{300 + i}",
                    store=store,
                    department=dept,
                    nature=selected_nature,
                    priority=selected_priority,
                    status=selected_status,
                    title=f"{selected_nature.nature_name} #{i} - {store.store_name}",
                    description=f"Maintenance issue #{i} at {store.store_name}. Status: {selected_status.status_name}",
                    created_by=admin_user
                )
                ticket._bypass_status_rule = True
                ticket.save()
                tickets.append(ticket)

                # Assign targeted worker to ticket
                alloc = Allocation.objects.create(
                    ticket=ticket,
                    worker=worker,
                    assigned_by=admin_user,
                    planned_hours=Decimal("4.00"),
                    remarks=f"Assigned to {worker.full_name or worker.username}"
                )

                # Attach Before & After media with placeholder URL
                Media.objects.create(
                    ticket=ticket,
                    uploaded_by=admin_user,
                    category=cat_before,
                    file_name="before_repair.png",
                    file_url=PLACEHOLDER_IMAGE
                )
                Media.objects.create(
                    ticket=ticket,
                    uploaded_by=worker,
                    category=cat_after,
                    file_name="after_repair.png",
                    file_url=PLACEHOLDER_IMAGE
                )

                # Add multiple work time logs per ticket
                for wl_idx in range(1, random.randint(2, 3)):
                    hours = Decimal(str(random.choice([1.5, 2.5, 4.0, 5.0])))
                    rate = Decimal("15.00")
                    WorkLog.objects.create(
                        ticket=ticket,
                        worker=worker,
                        allocation=alloc,
                        work_date=today -
                        timedelta(days=random.randint(1, 10)),
                        hours=hours,
                        hourly_rate=rate,
                        labour_amount=hours * rate,
                        work_done=f"Work log #{wl_idx} for ticket {ticket.work_order_no}",
                        is_claimed=False
                    )

                # Add multiple expenses per ticket - UNCLAIMED; workflow started only if approve_required is True
                for exp_idx in range(1, random.randint(2, 3)):
                    exp_amount = Decimal(
                        str(random.choice([35.00, 75.50, 120.00, 240.00, 450.00])))
                    exp_type = random.choice(expense_types)
                    is_req = exp_type.approve_required

                    exp = Expense.objects.create(
                        ticket=ticket,
                        worker=worker,
                        added_by=worker,
                        expense_type=exp_type,
                        amount=exp_amount,
                        expense_date=today -
                        timedelta(days=random.randint(1, 7)),
                        remarks=f"Expense #{exp_idx} ({exp_type.expense_name}) for ticket {ticket.work_order_no}",
                        approved=not is_req,
                        approved_by=admin_user if not is_req else None,
                        responsible_store=store,
                        is_claimed=False,
                        claim=None
                    )

                    # Add receipt media with placeholder URL
                    Media.objects.create(
                        expense=exp,
                        ticket=ticket,
                        uploaded_by=worker,
                        category=cat_receipt,
                        file_name="expense_receipt.png",
                        file_url=PLACEHOLDER_IMAGE
                    )

                    # Start 1-level single expense approval workflow if approval is required
                    if is_req:
                        ApprovalService.start_workflow(exp, actor=worker)

                self.stdout.write(self.style.SUCCESS(
                    f"  + Created Ticket {ticket.work_order_no} | Store: {store.store_name} | Status: {selected_status.status_name} | Worker: {worker.username}"
                ))

            self.stdout.write(self.style.SUCCESS(
                f"\nSuccessfully seeded {len(tickets)} tickets for workers {target_usernames} with ALL expenses set to Unclaimed & Pending Approval!"
            ))
