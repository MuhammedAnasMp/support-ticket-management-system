from rest_framework import viewsets, exceptions
from decimal import Decimal
from .models import ExpenseType, EmployeeRate, Expense, Reconciliation, WorkerClaim
from .serializers import (
    ExpenseTypeSerializer, EmployeeRateSerializer, ExpenseSerializer,
    ReconciliationSerializer, ExpenseWriteSerializer, ExpenseTypeWriteSerializer,
    WorkerClaimSerializer, WorkerClaimWriteSerializer
)


class ExpenseTypeViewSet(viewsets.ModelViewSet):
    queryset = ExpenseType.objects.all()
    serializer_class = ExpenseTypeSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ExpenseTypeWriteSerializer
        return ExpenseTypeSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)

        has_parent = self.request.query_params.get('has_parent')
        if has_parent is not None:
            if has_parent.lower() in ['true', '1']:
                queryset = queryset.filter(parent__isnull=False)
            elif has_parent.lower() in ['false', '0']:
                queryset = queryset.filter(parent__isnull=True)
        elif self.action == 'list':
            queryset = queryset.filter(parent__isnull=False)

        return queryset


class EmployeeRateViewSet(viewsets.ModelViewSet):
    queryset = EmployeeRate.objects.all()
    serializer_class = EmployeeRateSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return EmployeeRate.objects.none()
        
        # Admins or users with general permission to view rates can see all
        if user.is_superuser or user.has_perm('finance.view_employeerate') or user.has_perm('accounts.view_customuser'):
            return queryset
            
        # Standard workers can only view their own rate
        return queryset.filter(worker=user)


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ExpenseWriteSerializer
        return ExpenseSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return Expense.objects.none()

        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '')
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)]
        is_management = role_name in ('management', 'management team') or 'management' in user_groups_lower

        if not user.is_superuser and not is_management:
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})
        if serializer.instance.is_claimed:
            raise exceptions.PermissionDenied({'detail': 'This expense has been claimed and cannot be modified.'})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})
        if instance.is_claimed:
            raise exceptions.PermissionDenied({'detail': 'This expense has been claimed and cannot be deleted.'})
        instance.delete()


class WorkerClaimViewSet(viewsets.ModelViewSet):
    queryset = WorkerClaim.objects.all()
    serializer_class = WorkerClaimSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WorkerClaimWriteSerializer
        return WorkerClaimSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return WorkerClaim.objects.none()

        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '')
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)]
        is_management = role_name in ('management', 'management team') or 'management' in user_groups_lower

        if not user.is_superuser and not is_management and not user.has_perm('finance.approve_workerclaim'):
            queryset = queryset.filter(worker=user)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        expense_ids = serializer.validated_data.pop('expense_ids', [])
        worklog_ids = serializer.validated_data.pop('worklog_ids', [])

        if not serializer.validated_data.get('worker'):
            claim = serializer.save(worker=user)
        else:
            claim = serializer.save()

        self._process_claim_items(claim, expense_ids, worklog_ids)

    def perform_update(self, serializer):
        expense_ids = serializer.validated_data.pop('expense_ids', None)
        worklog_ids = serializer.validated_data.pop('worklog_ids', None)

        claim = serializer.save()

        if expense_ids is not None or worklog_ids is not None:
            self._process_claim_items(claim, expense_ids or [], worklog_ids or [])
        else:
            self._recalculate_claim_total(claim)

    def _process_claim_items(self, claim, expense_ids, worklog_ids):
        ticket = claim.ticket
        total = Decimal('0.00')

        if expense_ids:
            expenses = Expense.objects.filter(expense_id__in=expense_ids, ticket=ticket)
            expenses.update(is_claimed=True, claim=claim)
            total += sum(exp.amount for exp in expenses)

        if worklog_ids:
            from apps.maintenance.models import WorkLog
            worklogs = WorkLog.objects.filter(worklog_id__in=worklog_ids, ticket=ticket)
            worklogs.update(is_claimed=True, claim=claim)
            total += sum(wl.labour_amount for wl in worklogs)

        claim.total_claimed_amount = total
        claim.save(update_fields=['total_claimed_amount'])

    def _recalculate_claim_total(self, claim):
        total_expenses = sum(exp.amount for exp in claim.expenses.all())
        total_worklogs = sum(wl.labour_amount for wl in claim.work_logs.all())
        claim.total_claimed_amount = total_expenses + total_worklogs
        claim.save(update_fields=['total_claimed_amount'])


def recalculate_reconciliation(instance):
    ticket = instance.ticket
    if not ticket:
        return

    all_expenses = ticket.expenses.filter(approved=True)
    all_worklogs = ticket.work_logs.all()

    labour_total = sum(wl.labour_amount for wl in all_worklogs)
    expense_total = sum(exp.amount for exp in all_expenses)

    if instance.labour_total is None or instance.labour_total == Decimal('0.00'):
        instance.labour_total = labour_total
    if instance.expense_total is None or instance.expense_total == Decimal('0.00'):
        instance.expense_total = expense_total
    if instance.material_total is None:
        instance.material_total = Decimal('0.00')

    instance.grand_total = instance.labour_total + instance.expense_total + instance.material_total

    claimed_expenses = all_expenses.filter(is_claimed=True)
    claimed_worklogs = all_worklogs.filter(is_claimed=True)

    claimed_expense_total = sum(exp.amount for exp in claimed_expenses)
    claimed_labour_total = sum(wl.labour_amount for wl in claimed_worklogs)
    total_claimed_amount = claimed_expense_total + claimed_labour_total

    instance.claimed_labour_total = claimed_labour_total
    instance.claimed_expense_total = claimed_expense_total
    instance.total_claimed_amount = total_claimed_amount
    instance.net_payable_amount = max(Decimal('0.00'), instance.grand_total - total_claimed_amount)


class ReconciliationViewSet(viewsets.ModelViewSet):
    queryset = Reconciliation.objects.all()
    serializer_class = ReconciliationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return Reconciliation.objects.none()

        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '')
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)]
        is_management = role_name in ('management', 'management team') or 'management' in user_groups_lower

        if not user.is_superuser and not is_management:
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        recalculate_reconciliation(instance)
        instance.save()

    def perform_update(self, serializer):
        instance = serializer.save()
        recalculate_reconciliation(instance)
        instance.save()

