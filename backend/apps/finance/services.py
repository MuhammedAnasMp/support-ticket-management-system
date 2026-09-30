from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal

from .models import (
    WorkerClaim, Expense, Ledger, LedgerGroup,
    ApprovalWorkflow, ApprovalStep, ApprovalInstance,
    AuditEvent, Payment
)
from apps.accounts.models import Role


def create_audit_event(entity_name, entity_id, action, actor=None, payload=None, ip_address=None):
    """
    Creates an immutable audit record for financial transactions.
    """
    return AuditEvent.objects.create(
        entity_name=str(entity_name),
        entity_id=str(entity_id),
        action=action,
        actor=actor,
        payload=payload or {},
        ip_address=ip_address
    )


class ApprovalService:
    @staticmethod
    def get_active_workflow(entity_type):
        return ApprovalWorkflow.objects.filter(entity_type=entity_type, is_active=True).first()

    @classmethod
    def start_workflow(cls, entity, actor, ip_address=None):
        """
        Starts the approval workflow for a given entity (WorkerClaim, Ledger, or Expense).
        """
        is_bundle = isinstance(entity, WorkerClaim)
        is_expense = isinstance(entity, Expense)
        wf_entity_type = 'Bundle' if is_bundle else (
            'Expense' if is_expense else 'Ledger')
        audit_entity_name = 'WorkerClaim' if is_bundle else (
            'Expense' if is_expense else 'Ledger')
        entity_pk = getattr(entity, 'claim_id', getattr(
            entity, 'ledger_id', getattr(entity, 'expense_id', entity.pk)))

        if is_expense and entity.expense_type and not entity.expense_type.approve_required:
            entity.approved = True
            entity.approved_by = actor
            entity.save(update_fields=['approved', 'approved_by'])
            create_audit_event(audit_entity_name, entity_pk, 'AUTO_APPROVED', actor=actor, payload={
                               'reason': 'ExpenseType does not require approval'}, ip_address=ip_address)
            return None

        workflow = cls.get_active_workflow(wf_entity_type)

        if not workflow:
            # If no multi-step workflow defined, auto-approve
            if hasattr(entity, 'approved'):
                entity.approved = True
                entity.approved_by = actor
                entity.save(update_fields=['approved', 'approved_by'])
            else:
                entity.status = 'Approved'
                if hasattr(entity, 'approved_by'):
                    entity.approved_by = actor
                entity.save(update_fields=[
                            'status'] + (['approved_by'] if hasattr(entity, 'approved_by') else []))
            create_audit_event(audit_entity_name, entity_pk, 'AUTO_APPROVED', actor=actor, payload={
                               'reason': 'No active workflow'}, ip_address=ip_address)
            return None

        first_step = workflow.steps.order_by('step_order').first()
        if not first_step:
            if hasattr(entity, 'approved'):
                entity.approved = True
                entity.save(update_fields=['approved'])
            else:
                entity.status = 'Approved'
                entity.save(update_fields=['status'])
            create_audit_event(audit_entity_name, entity_pk, 'AUTO_APPROVED', actor=actor, payload={
                               'reason': 'Workflow has no steps'}, ip_address=ip_address)
            return None

        # Update entity status to In Review if status field exists
        if hasattr(entity, 'status'):
            entity.status = 'In Review' if wf_entity_type == 'Ledger' else 'Submitted'
            entity.save(update_fields=['status'])

        # Create first approval instance
        instance = ApprovalInstance.objects.create(
            step=first_step,
            claim=entity if is_bundle else None,
            ledger=entity if not is_bundle and not is_expense else None,
            expense=entity if is_expense else None,
            status='Pending'
        )

        create_audit_event(
            audit_entity_name,
            entity_pk,
            'WORKFLOW_STARTED',
            actor=actor,
            payload={'workflow_id': workflow.workflow_id,
                     'step_id': first_step.step_id, 'step_name': first_step.step_name},
            ip_address=ip_address
        )
        return instance

    @classmethod
    def action_step(cls, instance_id, actor, action, comments=None, ip_address=None):
        """
        Processes an approval action ('APPROVED', 'REJECTED', 'REWORK') for an ApprovalInstance.
        """
        valid_actions = ['APPROVED', 'REJECTED', 'REWORK']
        if action not in valid_actions:
            raise ValidationError(
                f"Invalid action '{action}'. Must be one of {valid_actions}")

        with transaction.atomic():
            instance = ApprovalInstance.objects.select_for_update().get(pk=instance_id)

            if instance.status != 'Pending':
                raise ValidationError(
                    f"Approval instance #{instance_id} is already processed ({instance.status}).")

            # Check actor role permission
            step = instance.step
            required_role = step.assigned_role
            if not actor.is_superuser and getattr(actor, 'role', None) != required_role:
                actor_role_name = actor.role.role_name if getattr(
                    actor, 'role', None) else 'None'
                raise ValidationError(
                    f"User role '{actor_role_name}' is not authorized for step '{step.step_name}' (requires '{required_role.role_name}')."
                )

            instance.action_by = actor
            instance.comments = comments
            instance.actioned_at = timezone.now()

            entity = instance.claim or instance.ledger or instance.expense
            audit_entity_name = 'WorkerClaim' if instance.claim else (
                'Expense' if instance.expense else 'Ledger')
            entity_id = instance.claim_id if instance.claim else (
                instance.expense_id if instance.expense else instance.ledger_id)

            if action == 'APPROVED':
                instance.status = 'Approved'
                instance.save()

                # Check if there is a next step
                workflow = step.workflow
                next_step = workflow.steps.filter(
                    step_order__gt=step.step_order).order_by('step_order').first()

                if next_step and not step.is_final_step:
                    # Move to next step
                    ApprovalInstance.objects.create(
                        step=next_step,
                        claim=instance.claim,
                        ledger=instance.ledger,
                        expense=instance.expense,
                        status='Pending'
                    )
                    if hasattr(entity, 'status'):
                        entity.status = 'In Review'
                        entity.save(update_fields=['status'])
                    create_audit_event(
                        audit_entity_name, entity_id, 'APPROVED_STEP', actor=actor,
                        payload={
                            'step_id': step.step_id, 'next_step_id': next_step.step_id, 'comments': comments},
                        ip_address=ip_address
                    )
                else:
                    # Final approval reached
                    if hasattr(entity, 'approved'):
                        entity.approved = True
                        entity.approved_by = actor
                        entity.save(update_fields=['approved', 'approved_by'])
                    else:
                        entity.status = 'Approved'
                        if hasattr(entity, 'approved_by'):
                            entity.approved_by = actor
                        entity.save()

                    create_audit_event(
                        audit_entity_name, entity_id, 'APPROVED_FINAL', actor=actor,
                        payload={'step_id': step.step_id,
                                 'comments': comments},
                        ip_address=ip_address
                    )

            elif action == 'REJECTED':
                instance.status = 'Rejected'
                instance.save()

                if hasattr(entity, 'approved'):
                    entity.approved = False
                    entity.save(update_fields=['approved'])
                elif hasattr(entity, 'status'):
                    entity.status = 'Rejected'
                    if hasattr(entity, 'reject_reason'):
                        entity.reject_reason = comments
                    entity.save()

                # When a bundle or ledger is rejected, retain tied expenses in the bundle and mark status as Rejected
                if instance.claim:
                    instance.claim.status = 'Rejected'
                    if hasattr(instance.claim, 'reject_reason'):
                        instance.claim.reject_reason = comments
                    instance.claim.save()

                if instance.ledger:
                    for bundle in instance.ledger.bundles.all():
                        bundle.status = 'Rejected'
                        if hasattr(bundle, 'reject_reason'):
                            bundle.reject_reason = f"Rejected via Ledger #{instance.ledger.ledger_id}: {comments or ''}"
                        bundle.save()

                create_audit_event(
                    audit_entity_name, entity_id, 'REJECTED', actor=actor,
                    payload={'step_id': step.step_id, 'comments': comments},
                    ip_address=ip_address
                )

            elif action == 'REWORK':
                instance.status = 'Rework'
                instance.save()

                if hasattr(entity, 'status'):
                    entity.status = 'Rework'
                    if hasattr(entity, 'remarks'):
                        entity.remarks = (
                            entity.remarks or '') + f"\n[Rework requested by {actor.username}]: {comments}"
                    entity.save()

                create_audit_event(
                    audit_entity_name, entity_id, 'REWORK_REQUESTED', actor=actor,
                    payload={'step_id': step.step_id, 'comments': comments},
                    ip_address=ip_address
                )

            return instance

            return instance


class BundleService:
    @classmethod
    def create_bundle(cls, worker, expense_ids, period_from=None, period_to=None, remarks=None, created_by=None, ip_address=None):
        """
        Creates a new WorkerClaim (Bundle) containing the specified expense IDs.
        """
        if not expense_ids:
            raise ValidationError(
                "Cannot create a bundle with empty expenses list.")

        if not period_from or not period_to:
            raise ValidationError(
                "Billing period (From & To dates) is required for creating a bundle.")

        if not remarks or not str(remarks).strip():
            raise ValidationError(
                "Bundle remarks are required for creating a bundle.")

        with transaction.atomic():
            expenses = Expense.objects.select_for_update().filter(expense_id__in=expense_ids)

            if len(expenses) != len(expense_ids):
                raise ValidationError("One or more expense IDs do not exist.")

            if not worker:
                worker = expenses.first().worker

            for exp in expenses:
                if exp.worker_id != worker.pk:
                    worker_name = exp.worker.full_name or exp.worker.username if exp.worker else 'another technician'
                    target_name = worker.full_name or worker.username
                    raise ValidationError(
                        f"Expense #{exp.expense_id} belongs to '{worker_name}', but this bundle is for '{target_name}'. A bundle must contain expenses for a single technician.")
                if exp.is_claimed or exp.claim_id is not None:
                    raise ValidationError(
                        f"Expense #{exp.expense_id} is already claimed in Bundle {exp.claim_id}.")
                if not exp.approved and not (exp.expense_type and not exp.expense_type.approve_required):
                    raise ValidationError(
                        f"Expense #{exp.expense_id} is pending approval and cannot be included in a bundle until approved.")

            total_amount = sum(exp.amount for exp in expenses)

            bundle = WorkerClaim.objects.create(
                worker=worker,
                total_claimed_amount=total_amount,
                status='Draft',
                period_from=period_from,
                period_to=period_to,
                remarks=remarks,
                submitted_by=created_by
            )

            expenses.update(is_claimed=True, claim=bundle)

            create_audit_event(
                'WorkerClaim', bundle.claim_id, 'BUNDLE_CREATED', actor=created_by,
                payload={'expense_ids': list(
                    expense_ids), 'total_amount': str(total_amount)},
                ip_address=ip_address
            )

            return bundle

    @classmethod
    def update_bundle(cls, bundle_id, expense_ids=None, period_from=None, period_to=None, remarks=None, actor=None, ip_address=None):
        """
        Updates an existing WorkerClaim (Bundle), allowing adding/removing expenses and updating remarks/dates.
        """
        with transaction.atomic():
            bundle = WorkerClaim.objects.select_for_update().get(pk=bundle_id)

            if bundle.status not in ['Draft', 'Rework', 'Rejected', 'Approved']:
                raise ValidationError(
                    f"Bundle {bundle_id} is in status '{bundle.status}' and cannot be edited.")

            if bundle.ledgers.exists():
                for lg in bundle.ledgers.all():
                    if lg.status not in ['Draft', 'Rework', 'Rejected']:
                        raise ValidationError(
                            f"This bundle is attached to Ledger Batch #{lg.ledger_id} ({lg.status}) and cannot be modified.")

            if period_from is not None:
                bundle.period_from = period_from if period_from else None
            if period_to is not None:
                bundle.period_to = period_to if period_to else None
            if remarks is not None:
                bundle.remarks = remarks

            if expense_ids is not None:
                if len(expense_ids) == 0:
                    raise ValidationError(
                        "A bundle must contain at least one expense.")

                # Get current expenses linked to this bundle
                current_expenses = list(
                    Expense.objects.select_for_update().filter(claim=bundle))
                current_ids = set(e.expense_id for e in current_expenses)
                target_ids = set(int(eid) for eid in expense_ids)

                to_remove_ids = current_ids - target_ids
                to_add_ids = target_ids - current_ids

                # Remove expenses that are unselected
                if to_remove_ids:
                    Expense.objects.filter(expense_id__in=to_remove_ids, claim=bundle).update(
                        is_claimed=False, claim=None)

                # Add new expenses that are selected
                if to_add_ids:
                    new_expenses = Expense.objects.select_for_update().filter(expense_id__in=to_add_ids)
                    for exp in new_expenses:
                        if exp.worker_id != bundle.worker_id:
                            worker_name = exp.worker.full_name or exp.worker.username if exp.worker else 'another technician'
                            target_name = bundle.worker.full_name or bundle.worker.username if bundle.worker else 'technician'
                            raise ValidationError(
                                f"Expense #{exp.expense_id} belongs to '{worker_name}', but this bundle is for '{target_name}'.")
                        if exp.is_claimed and exp.claim_id != bundle.claim_id:
                            raise ValidationError(
                                f"Expense #{exp.expense_id} is already claimed in Bundle {exp.claim_id}.")
                        if not exp.approved and not (exp.expense_type and not exp.expense_type.approve_required):
                            raise ValidationError(
                                f"Expense #{exp.expense_id} is pending approval and cannot be added.")
                    new_expenses.update(is_claimed=True, claim=bundle)

            # Recalculate total claimed amount from all expenses currently linked to bundle
            bundle.total_claimed_amount = sum(
                exp.amount for exp in Expense.objects.filter(claim=bundle))
            bundle.save()

            # Resync any parent ledgers attached to this bundle
            for lg in bundle.ledgers.all():
                bundle_expenses = Expense.objects.filter(claim__in=lg.bundles.all())
                lg.expenses.set(bundle_expenses)
                LedgerService.recalculate_ledger_total(lg)

            create_audit_event(
                'WorkerClaim', bundle.claim_id, 'BUNDLE_UPDATED', actor=actor,
                payload={'expense_ids': list(expense_ids) if expense_ids is not None else [
                ], 'total_amount': str(bundle.total_claimed_amount)},
                ip_address=ip_address
            )

            return bundle

    @classmethod
    def delete_bundle(cls, bundle_id, actor=None, ip_address=None):
        """
        Deletes a WorkerClaim (Bundle) and resets all attached expenses back to unclaimed status.
        """
        with transaction.atomic():
            bundle = WorkerClaim.objects.select_for_update().get(pk=bundle_id)

            if bundle.ledgers.exists():
                raise ValidationError(
                    "This bundle is attached to a ledger batch and cannot be deleted.")

            if bundle.status in ('Approved', 'Paid'):
                raise ValidationError(
                    "Approved or Paid bundles cannot be deleted.")

            # Reset all tied expenses back to their original unclaimed position
            Expense.objects.filter(claim=bundle).update(
                is_claimed=False, claim=None)

            create_audit_event(
                'WorkerClaim', bundle.claim_id, 'BUNDLE_DELETED', actor=actor,
                payload={'total_amount': str(bundle.total_claimed_amount)},
                ip_address=ip_address
            )

            bundle.delete()

    @classmethod
    def submit_bundle(cls, bundle_id, actor, ip_address=None):
        """
        Submits a Draft or Rework bundle for multi-step approval.
        """
        with transaction.atomic():
            bundle = WorkerClaim.objects.select_for_update().get(pk=bundle_id)

            if bundle.status not in ['Draft', 'Rework', 'Rejected']:
                raise ValidationError(
                    f"Bundle {bundle_id} is in status '{bundle.status}' and cannot be submitted.")

            bundle.submitted_at = timezone.now()
            bundle.submitted_by = actor
            bundle.status = 'Submitted'
            bundle.save()

            ApprovalService.start_workflow(
                bundle, actor, ip_address=ip_address)

            create_audit_event(
                'WorkerClaim', bundle.claim_id, 'BUNDLE_SUBMITTED', actor=actor,
                payload={'total_amount': str(bundle.total_claimed_amount)},
                ip_address=ip_address
            )

            return bundle


class LedgerService:
    @classmethod
    def recalculate_ledger_total(cls, ledger):
        """
        Recalculates total_amount of a Ledger batch based on its expenses and/or bundles.
        """
        attached_expenses = list(ledger.expenses.all())
        if attached_expenses:
            total = sum(e.amount for e in attached_expenses)
        else:
            total = sum(b.total_claimed_amount for b in ledger.bundles.all())

        ledger.total_amount = Decimal(str(total))
        ledger.save(update_fields=['total_amount'])
        return total

    @classmethod
    def create_ledger(cls, bundle_ids, created_by, ledger_group_id=None, remarks=None, ip_address=None):
        """
        Creates a new Ledger combining multiple approved WorkerClaims (Bundles).
        """
        if not bundle_ids:
            raise ValidationError("Cannot create a ledger without bundles.")

        with transaction.atomic():
            bundles = WorkerClaim.objects.select_for_update().filter(claim_id__in=bundle_ids)

            if len(bundles) != len(bundle_ids):
                raise ValidationError("One or more bundle IDs do not exist.")

            for b in bundles:
                if b.status != 'Approved':
                    raise ValidationError(
                        f"Bundle {b.claim_id} is in status '{b.status}'. Only 'Approved' bundles can be added to a Ledger.")
                if b.ledgers.exists():
                    raise ValidationError(
                        f"Bundle {b.claim_id} is already attached to a Ledger batch and cannot be added to another Ledger.")

            ledger_group = None
            if ledger_group_id:
                ledger_group = LedgerGroup.objects.get(pk=ledger_group_id)

            total_amount = sum(b.total_claimed_amount for b in bundles)

            ledger = Ledger.objects.create(
                ledger_group=ledger_group,
                store=None,
                created_by=created_by,
                total_amount=total_amount,
                status='Draft',
                remarks=remarks
            )
            ledger.bundles.set(bundles)

            # Also populate expenses from bundles
            bundle_expenses = Expense.objects.filter(claim__in=bundles)
            ledger.expenses.set(bundle_expenses)
            cls.recalculate_ledger_total(ledger)

            create_audit_event(
                'Ledger', ledger.ledger_id, 'LEDGER_CREATED', actor=created_by,
                payload={'bundle_ids': list(
                    bundle_ids), 'total_amount': str(total_amount)},
                ip_address=ip_address
            )

            return ledger

    @classmethod
    def submit_ledger(cls, ledger_id, actor, ip_address=None):
        """
        Submits a Ledger for approval.
        """
        with transaction.atomic():
            ledger = Ledger.objects.select_for_update().get(pk=ledger_id)

            if ledger.status not in ['Draft', 'Rework', 'Rejected']:
                raise ValidationError(
                    f"Ledger #{ledger_id} is in status '{ledger.status}' and cannot be submitted.")

            ledger.status = 'Submitted'
            ledger.save()

            ApprovalService.start_workflow(
                ledger, actor, ip_address=ip_address)

            create_audit_event(
                'Ledger', ledger.ledger_id, 'LEDGER_SUBMITTED', actor=actor,
                payload={'total_amount': str(ledger.total_amount)},
                ip_address=ip_address
            )

            return ledger

    @classmethod
    def add_expense(cls, ledger_id, expense_id, actor=None, ip_address=None):
        """
        Adds an approved expense to a draft/in-review Ledger batch.
        """
        with transaction.atomic():
            ledger = Ledger.objects.select_for_update().get(pk=ledger_id)
            if ledger.status not in ['Draft', 'Rework']:
                raise ValidationError(
                    f"Ledger #{ledger_id} is in status '{ledger.status}' and cannot be modified.")

            expense = Expense.objects.select_for_update().get(pk=expense_id)
            if ledger.expenses.filter(pk=expense_id).exists():
                raise ValidationError(
                    f"Expense #{expense_id} is already included in Ledger Batch #{ledger_id}.")

            ledger.expenses.add(expense)
            expense.is_claimed = True
            expense.save(update_fields=['is_claimed'])
            cls.recalculate_ledger_total(ledger)

            create_audit_event(
                'Ledger', ledger.ledger_id, 'EXPENSE_ADDED', actor=actor,
                payload={'expense_id': expense_id,
                         'amount': str(expense.amount)},
                ip_address=ip_address
            )
            return ledger

    @classmethod
    def remove_expense(cls, ledger_id, expense_id, actor=None, ip_address=None):
        """
        Removes an expense from a Ledger batch and its bundle (if linked).
        """
        with transaction.atomic():
            ledger = Ledger.objects.select_for_update().get(pk=ledger_id)
            if ledger.status in ['Paid', 'Approved']:
                raise ValidationError(
                    f"Ledger #{ledger_id} is in status '{ledger.status}' and cannot be modified.")

            expense = Expense.objects.select_for_update().get(pk=expense_id)

            # Unlink expense from its bundle if it belongs to one
            if expense.claim:
                bundle = expense.claim
                expense.is_claimed = False
                expense.claim = None
                expense.save(update_fields=['is_claimed', 'claim'])

                # Recalculate bundle total claimed amount
                bundle.total_claimed_amount = sum(
                    e.amount for e in Expense.objects.filter(claim=bundle))
                bundle.save(update_fields=['total_claimed_amount'])

            # Remove from direct expenses on ledger if present
            if expense in ledger.expenses.all():
                ledger.expenses.remove(expense)

            if not expense.claim and not expense.ledgers.exists():
                expense.is_claimed = False
                expense.save(update_fields=['is_claimed'])

            cls.recalculate_ledger_total(ledger)

            create_audit_event(
                'Ledger', ledger.ledger_id, 'EXPENSE_REMOVED', actor=actor,
                payload={'expense_id': expense_id,
                         'amount': str(expense.amount)},
                ip_address=ip_address
            )
            return ledger

    @classmethod
    def add_bundle(cls, ledger_id, bundle_id, actor=None, ip_address=None):
        """
        Attaches an approved bundle to an editable (Draft/Rework/Rejected) Ledger batch.
        """
        with transaction.atomic():
            ledger = Ledger.objects.select_for_update().get(pk=ledger_id)
            if ledger.status not in ['Draft', 'Rework', 'Rejected']:
                raise ValidationError(
                    f"Ledger #{ledger_id} is in status '{ledger.status}' and cannot be modified.")

            bundle = WorkerClaim.objects.select_for_update().get(pk=bundle_id)
            if bundle.status != 'Approved':
                raise ValidationError(
                    f"Bundle {bundle.claim_id} is in status '{bundle.status}'. Only Approved bundles can be added to a Ledger.")

            if bundle.ledgers.exclude(pk=ledger_id).exists():
                raise ValidationError(
                    f"Bundle {bundle.claim_id} is already attached to another Ledger batch.")

            ledger.bundles.add(bundle)
            for exp in Expense.objects.filter(claim=bundle):
                ledger.expenses.add(exp)

            cls.recalculate_ledger_total(ledger)

            create_audit_event(
                'Ledger', ledger.ledger_id, 'BUNDLE_ADDED', actor=actor,
                payload={'bundle_id': bundle_id,
                         'amount': str(bundle.total_claimed_amount)},
                ip_address=ip_address
            )
            return ledger

    @classmethod
    def remove_bundle(cls, ledger_id, bundle_id, actor=None, ip_address=None):
        """
        Detaches a bundle from an editable Ledger batch.
        """
        with transaction.atomic():
            ledger = Ledger.objects.select_for_update().get(pk=ledger_id)
            if ledger.status in ['Approved', 'Paid']:
                raise ValidationError(
                    f"Ledger #{ledger_id} is in status '{ledger.status}' and cannot be modified.")

            bundle = WorkerClaim.objects.select_for_update().get(pk=bundle_id)
            if bundle not in ledger.bundles.all():
                raise ValidationError(
                    f"Bundle {bundle.claim_id} is not attached to Ledger #{ledger_id}.")

            ledger.bundles.remove(bundle)
            for exp in Expense.objects.filter(claim=bundle):
                if exp in ledger.expenses.all():
                    ledger.expenses.remove(exp)

            cls.recalculate_ledger_total(ledger)

            create_audit_event(
                'Ledger', ledger.ledger_id, 'BUNDLE_REMOVED', actor=actor,
                payload={'bundle_id': bundle_id,
                         'amount': str(bundle.total_claimed_amount)},
                ip_address=ip_address
            )
            return ledger

    @classmethod
    def delete_ledger(cls, ledger_id, actor=None, ip_address=None):
        """
        Deletes a Ledger batch. Allowed for non-paid / non-approved ledgers (Draft, Submitted, In Review, Rejected, Rework).
        """
        with transaction.atomic():
            ledger = Ledger.objects.select_for_update().get(pk=ledger_id)

            if ledger.status in ('Approved', 'Paid'):
                raise ValidationError(
                    "Approved or Paid ledger batches cannot be deleted.")

            create_audit_event(
                'Ledger', ledger.ledger_id, 'LEDGER_DELETED', actor=actor,
                payload={'total_amount': str(ledger.total_amount)},
                ip_address=ip_address
            )

            ledger.bundles.clear()
            ledger.expenses.clear()
            ledger.delete()


class PaymentService:
    @classmethod
    def process_payment(cls, actor, payment_method, amount_paid, bundle_id=None, ledger_id=None, expense_id=None, transaction_reference=None, remarks=None, ip_address=None):
        """
        Processes a payment for an approved Bundle or Ledger or individual Expense.
        """
        amount_paid = Decimal(str(amount_paid))

        with transaction.atomic():
            bundle = WorkerClaim.objects.select_for_update().get(
                pk=bundle_id) if bundle_id else None
            ledger = Ledger.objects.select_for_update().get(
                pk=ledger_id) if ledger_id else None
            expense = Expense.objects.select_for_update().get(
                pk=expense_id) if expense_id else None

            if not any([bundle, ledger, expense]):
                raise ValidationError(
                    "Must specify one of bundle_id, ledger_id, or expense_id to record payment.")

            target_entity = bundle or ledger or expense
            entity_name = 'WorkerClaim' if bundle else (
                'Ledger' if ledger else 'Expense')
            entity_id = getattr(target_entity, 'claim_id', getattr(
                target_entity, 'ledger_id', getattr(target_entity, 'expense_id', None)))

            if target_entity.status if hasattr(target_entity, 'status') else True:
                status = getattr(target_entity, 'status', 'Approved')
                if status != 'Approved':
                    raise ValidationError(
                        f"Cannot pay {entity_name} #{entity_id} because its status is '{status}' (requires 'Approved').")

            payment = Payment.objects.create(
                claim=bundle,
                ledger=ledger,
                expense=expense,
                amount_paid=amount_paid,
                payment_method=payment_method,
                transaction_reference=transaction_reference,
                paid_by=actor,
                remarks=remarks
            )

            if bundle:
                bundle.status = 'Paid'
                bundle.save(update_fields=['status'])
            elif ledger:
                ledger.status = 'Paid'
                ledger.save(update_fields=['status'])
                ledger.bundles.update(status='Paid')

            create_audit_event(
                entity_name, entity_id, 'PAYMENT_PROCESSED', actor=actor,
                payload={'payment_id': payment.payment_id, 'amount_paid': str(
                    amount_paid), 'payment_method': payment_method, 'reference': transaction_reference},
                ip_address=ip_address
            )

            return payment
