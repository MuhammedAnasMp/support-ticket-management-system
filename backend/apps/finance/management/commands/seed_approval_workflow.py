from django.core.management.base import BaseCommand
from django.db import transaction
from apps.accounts.models import Role
from apps.finance.models import ApprovalWorkflow, ApprovalStep


class Command(BaseCommand):
    help = "Seeds default Roles and standard multi-step ApprovalWorkflows for Bundles and Ledgers."

    def handle(self, *args, **options):
        self.stdout.write("Seeding default Approval Workflows and Roles...")

        roles_def = [
            ("Office Administrator", "Responsible for initial verification of worker expenses"),
            ("Store Manager", "Responsible for reviewing and approving ticket/store expenses"),
            ("Internal Auditor", "Responsible for auditing financial claims and ledger compliance"),
            ("Cash Officer", "Responsible for final payment disbursement and financial settlement"),
            ("Management", "Management team oversight")
        ]

        roles = {}
        for role_name, desc in roles_def:
            role, created = Role.objects.get_or_create(
                role_name=role_name,
                defaults={"description": desc} if hasattr(Role, 'description') else {}
            )
            roles[role_name] = role
            if created:
                self.stdout.write(self.style.SUCCESS(f"  + Created Role: {role_name}"))

        with transaction.atomic():
            # 1. Bundle Workflow
            bundle_wf, b_created = ApprovalWorkflow.objects.get_or_create(
                entity_type='Bundle',
                is_active=True,
                defaults={"name": "Standard Bundle Multi-Step Approval"}
            )
            if b_created:
                self.stdout.write(self.style.SUCCESS("  + Created Bundle Workflow: Standard Bundle Multi-Step Approval"))

            bundle_steps = [
                (1, "Accounts Verification", roles["Office Administrator"], False),
                (2, "Manager Review", roles["Store Manager"], False),
                (3, "Internal Audit", roles["Internal Auditor"], False),
                (4, "Cash Officer Settlement", roles["Cash Officer"], True),
            ]

            for order, name, role, is_final in bundle_steps:
                step, s_created = ApprovalStep.objects.get_or_create(
                    workflow=bundle_wf,
                    step_order=order,
                    defaults={
                        "step_name": name,
                        "assigned_role": role,
                        "is_final_step": is_final
                    }
                )
                if s_created:
                    self.stdout.write(self.style.SUCCESS(f"    - Step {order}: {name} ({role.role_name})"))

            # 2. Ledger Workflow
            ledger_wf, l_created = ApprovalWorkflow.objects.get_or_create(
                entity_type='Ledger',
                is_active=True,
                defaults={"name": "Standard Ledger Approval"}
            )
            if l_created:
                self.stdout.write(self.style.SUCCESS("  + Created Ledger Workflow: Standard Ledger Approval"))

            ledger_steps = [
                (1, "Audit Review", roles["Internal Auditor"], False),
                (2, "Executive Disbursement", roles["Cash Officer"], True),
            ]

            for order, name, role, is_final in ledger_steps:
                step, s_created = ApprovalStep.objects.get_or_create(
                    workflow=ledger_wf,
                    step_order=order,
                    defaults={
                        "step_name": name,
                        "assigned_role": role,
                        "is_final_step": is_final
                    }
                )
            # 3. Expense Workflow (Single Ticket Expenses)
            expense_wf, ex_created = ApprovalWorkflow.objects.get_or_create(
                entity_type='Expense',
                is_active=True,
                defaults={"name": "Single Expense Multi-Step Approval"}
            )
            if ex_created:
                self.stdout.write(self.style.SUCCESS("  + Created Expense Workflow: Single Expense Multi-Step Approval"))

            expense_steps = [
                (1, "Store Manager Approval", roles["Store Manager"], False),
                (2, "Office Administrator Verification", roles["Office Administrator"], True),
            ]

            for order, name, role, is_final in expense_steps:
                step, s_created = ApprovalStep.objects.get_or_create(
                    workflow=expense_wf,
                    step_order=order,
                    defaults={
                        "step_name": name,
                        "assigned_role": role,
                        "is_final_step": is_final
                    }
                )
                if s_created:
                    self.stdout.write(self.style.SUCCESS(f"    - Step {order}: {name} ({role.role_name})"))

        self.stdout.write(self.style.SUCCESS("Successfully seeded approval workflows and roles."))
