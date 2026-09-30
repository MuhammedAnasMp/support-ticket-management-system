from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.core.exceptions import ValidationError

from apps.accounts.models import Role
from apps.stores.models import Department, Store, SubDepartment
from apps.maintenance.models import Ticket, Priority, Status, WorkNature
from apps.finance.models import (
    ExpenseType, Expense, WorkerClaim, LedgerGroup, Ledger,
    ApprovalWorkflow, ApprovalStep, ApprovalInstance, AuditEvent, Payment
)
from apps.finance.services import BundleService, LedgerService, ApprovalService, PaymentService

User = get_user_model()


class FinancialSystemTestCase(TestCase):
    def setUp(self):
        # Create roles
        self.role_admin, _ = Role.objects.get_or_create(role_name="Office Administrator")
        self.role_manager, _ = Role.objects.get_or_create(role_name="Store Manager")
        self.role_auditor, _ = Role.objects.get_or_create(role_name="Internal Auditor")
        self.role_cashier, _ = Role.objects.get_or_create(role_name="Cash Officer")

        # Create users
        self.worker = User.objects.create_user(username="tech_john", password="password123")
        self.office_user = User.objects.create_user(username="office_mary", password="password123", role=self.role_admin)
        self.manager_user = User.objects.create_user(username="mgr_sam", password="password123", role=self.role_manager)
        self.auditor_user = User.objects.create_user(username="audit_dan", password="password123", role=self.role_auditor)
        self.cashier_user = User.objects.create_user(username="cash_lisa", password="password123", role=self.role_cashier)

        # Department & Store
        self.dept = Department.objects.create(department_name="HVAC Maintenance")
        self.store = Store.objects.create(store_id="S001", store_name="Main Branch")

        # Expense Type
        self.exp_type = ExpenseType.objects.create(
            department=self.dept,
            expense_name="Spare Parts",
            required=True,
            approve_required=False
        )

        # Priority, Status, Subdept, WorkNature
        self.priority = Priority.objects.create(department=self.dept, priority_name="High", level=1)
        self.status = Status.objects.create(status_name="Open")
        self.subdept = SubDepartment.objects.create(department=self.dept, sub_department_name="AC Repairs")
        self.nature = WorkNature.objects.create(nature_name="Compressor Repair", sub_department=self.subdept, default_priority=self.priority)

        # Ticket
        self.ticket = Ticket.objects.create(
            work_order_no="WO-9001",
            title="AC Repair",
            department=self.dept,
            store=self.store,
            nature=self.nature,
            priority=self.priority,
            status=self.status,
            created_by=self.office_user
        )

        # Seed Workflow
        self.workflow = ApprovalWorkflow.objects.create(
            name="Bundle 2-Step Workflow",
            entity_type="Bundle",
            is_active=True
        )
        self.step1 = ApprovalStep.objects.create(
            workflow=self.workflow,
            step_order=1,
            step_name="Office Check",
            assigned_role=self.role_admin,
            is_final_step=False
        )
        self.step2 = ApprovalStep.objects.create(
            workflow=self.workflow,
            step_order=2,
            step_name="Manager Approval",
            assigned_role=self.role_manager,
            is_final_step=True
        )

    def test_full_financial_workflow(self):
        # 1. Create individual expenses
        exp1 = Expense.objects.create(
            ticket=self.ticket,
            worker=self.worker,
            added_by=self.worker,
            expense_type=self.exp_type,
            amount=Decimal("150.00"),
            expense_date="2026-09-20",
            approved=True
        )
        exp2 = Expense.objects.create(
            ticket=self.ticket,
            worker=self.worker,
            added_by=self.worker,
            expense_type=self.exp_type,
            amount=Decimal("250.00"),
            expense_date="2026-09-21",
            approved=True
        )

        # 2. Bundle expenses into WorkerClaim (Bundle)
        bundle = BundleService.create_bundle(
            worker=self.worker,
            expense_ids=[exp1.expense_id, exp2.expense_id],
            period_from="2026-09-01",
            period_to="2026-09-20",
            remarks="Weekly HVAC repair expenses",
            created_by=self.worker
        )

        exp1.refresh_from_db()
        exp2.refresh_from_db()
        self.assertEqual(bundle.total_claimed_amount, Decimal("400.00"))
        self.assertEqual(bundle.status, "Draft")
        self.assertTrue(exp1.is_claimed)
        self.assertTrue(exp2.is_claimed)

        # 3. Submit Bundle for Approval
        BundleService.submit_bundle(bundle.claim_id, actor=self.worker)
        bundle.refresh_from_db()
        self.assertEqual(bundle.status, "Submitted")

        # Verify ApprovalInstance created for Step 1
        inst1 = ApprovalInstance.objects.filter(claim=bundle, status="Pending").first()
        self.assertIsNotNone(inst1)
        self.assertEqual(inst1.step, self.step1)

        # 4. Action Step 1 (Office Check) -> Approve
        ApprovalService.action_step(inst1.instance_id, actor=self.office_user, action="APPROVED", comments="Verified receipts")
        bundle.refresh_from_db()
        self.assertEqual(bundle.status, "In Review")

        # Verify ApprovalInstance created for Step 2
        inst2 = ApprovalInstance.objects.filter(claim=bundle, status="Pending").first()
        self.assertIsNotNone(inst2)
        self.assertEqual(inst2.step, self.step2)

        # 5. Action Step 2 (Manager Approval) -> Final Approve
        ApprovalService.action_step(inst2.instance_id, actor=self.manager_user, action="APPROVED", comments="Approved by Manager")
        bundle.refresh_from_db()
        self.assertEqual(bundle.status, "Approved")

        # 6. Group Approved Bundle into Ledger
        ledger_group = LedgerGroup.objects.create(group_name="September Batch A", created_by=self.office_user)
        ledger = LedgerService.create_ledger(
            bundle_ids=[bundle.claim_id],
            created_by=self.office_user,
            ledger_group_id=ledger_group.ledger_group_id,
            remarks="Batch 1 September"
        )
        self.assertEqual(ledger.total_amount, Decimal("400.00"))
        self.assertEqual(ledger.status, "Draft")

        # 7. Process Payment for Bundle
        payment = PaymentService.process_payment(
            actor=self.cashier_user,
            payment_method="Bank Transfer",
            amount_paid=Decimal("400.00"),
            bundle_id=bundle.claim_id,
            transaction_reference="TRX-100200"
        )

        bundle.refresh_from_db()
        self.assertEqual(bundle.status, "Paid")
        self.assertEqual(payment.amount_paid, Decimal("400.00"))

        # 8. Verify Audit Trail
        audit_events = AuditEvent.objects.filter(entity_name="WorkerClaim", entity_id=str(bundle.claim_id))
        self.assertTrue(audit_events.count() >= 4)

    def test_audit_event_immutability(self):
        audit = AuditEvent.objects.create(
            entity_name="WorkerClaim",
            entity_id="1",
            action="TEST_ACTION",
            actor=self.worker
        )
        # Attempting to modify must raise ValueError
        with self.assertRaises(ValueError):
            audit.action = "MODIFIED"
            audit.save()

        # Attempting to delete must raise ValueError
        with self.assertRaises(ValueError):
            audit.delete()

    def test_rejection_releases_expenses(self):
        exp = Expense.objects.create(
            ticket=self.ticket,
            worker=self.worker,
            expense_type=self.exp_type,
            amount=Decimal("100.00"),
            expense_date="2026-09-20",
            approved=True
        )
        bundle = BundleService.create_bundle(
            worker=self.worker,
            expense_ids=[exp.expense_id],
            period_from="2026-09-01",
            period_to="2026-09-20",
            remarks="Test bundle remarks",
            created_by=self.worker
        )
        BundleService.submit_bundle(bundle.claim_id, actor=self.worker)

        inst = ApprovalInstance.objects.filter(claim=bundle, status="Pending").first()
        ApprovalService.action_step(inst.instance_id, actor=self.office_user, action="REJECTED", comments="Invalid receipt")

        bundle.refresh_from_db()
        exp.refresh_from_db()

        self.assertEqual(bundle.status, "Rejected")
        self.assertFalse(exp.is_claimed)
        self.assertIsNone(exp.claim)
