from django.db.models import Q
from rest_framework import viewsets, exceptions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from decimal import Decimal

from .models import (
    ExpenseType, EmployeeRate, Expense, Reconciliation, WorkerClaim,
    LedgerGroup, Ledger, ApprovalWorkflow, ApprovalStep,
    ApprovalInstance, AuditEvent, Payment
)
from .serializers import (
    ExpenseTypeSerializer, EmployeeRateSerializer, ExpenseSerializer,
    ReconciliationSerializer, ExpenseWriteSerializer, ExpenseTypeWriteSerializer,
    WorkerClaimSerializer, WorkerClaimWriteSerializer,
    LedgerGroupSerializer, LedgerSerializer, LedgerWriteSerializer,
    ApprovalWorkflowSerializer, ApprovalStepSerializer, ApprovalInstanceSerializer,
    AuditEventSerializer, PaymentSerializer
)
from .services import (
    BundleService, LedgerService, ApprovalService, PaymentService
)


class FinancePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 1000

    def paginate_queryset(self, queryset, request, view=None):
        if (request.query_params.get('all') == 'true' or
                request.query_params.get('no_page') == 'true' or
                request.query_params.get('page_size') == 'all'):
            return None
        return super().paginate_queryset(queryset, request, view)


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

        if user.is_superuser or user.has_perm('finance.view_employeerate') or user.has_perm('accounts.view_customuser'):
            return queryset

        return queryset.filter(worker=user)


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    pagination_class = FinancePagination

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
                queryset = queryset.filter(
                    Q(ticket__store_id__in=accessible_store_ids) |
                    Q(responsible_store_id__in=accessible_store_ids) |
                    Q(ticket__isnull=True, responsible_store__isnull=True)
                )

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        is_claimed = self.request.query_params.get("is_claimed")
        if is_claimed is not None:
            if is_claimed.lower() in ('false', '0', 'no'):
                queryset = queryset.filter(is_claimed=False, claim__isnull=True)
            elif is_claimed.lower() in ('true', '1', 'yes'):
                queryset = queryset.filter(is_claimed=True)

        approved = self.request.query_params.get("approved")
        if approved is not None:
            if approved.lower() in ('true', '1', 'yes'):
                queryset = queryset.filter(Q(approved=True) | Q(expense_type__approve_required=False))
            elif approved.lower() in ('false', '0', 'no'):
                queryset = queryset.filter(approved=False, expense_type__approve_required=True)

        worker = self.request.query_params.get("worker")
        if worker:
            queryset = queryset.filter(worker_id=worker)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})
        expense = serializer.save(added_by=user)

        if expense.expense_type and not expense.expense_type.approve_required:
            expense.approved = True
            expense.approved_by = user
            expense.save(update_fields=['approved', 'approved_by'])
        else:
            # Trigger single Expense approval workflow if an active Expense workflow exists
            wf = ApprovalWorkflow.objects.filter(entity_type='Expense', is_active=True).first()
            if wf:
                ApprovalService.start_workflow(expense, user, ip_address=self.request.META.get('REMOTE_ADDR'))

    def perform_update(self, serializer):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})

        expense = serializer.instance
        recent_approval = expense.approval_instances.order_by('-created_at').first()
        is_approval_rejected_or_rework = recent_approval and recent_approval.status in ('Rejected', 'Rework')

        if expense.approved and not is_approval_rejected_or_rework:
            raise exceptions.PermissionDenied({'detail': 'Once approved, expenses cannot be modified.'})
        if expense.is_claimed:
            claim_status = expense.claim.status if expense.claim else None
            if claim_status not in ('Rejected', 'Rework') and not is_approval_rejected_or_rework:
                raise exceptions.PermissionDenied({'detail': 'This expense is in an active claim bundle and cannot be modified.'})

        updated_expense = serializer.save()

        if is_approval_rejected_or_rework:
            updated_expense.approved = False
            updated_expense.save(update_fields=['approved'])
            wf = ApprovalWorkflow.objects.filter(entity_type='Expense', is_active=True).first()
            if wf:
                ApprovalService.start_workflow(updated_expense, user, ip_address=self.request.META.get('REMOTE_ADDR'))

    def perform_destroy(self, instance):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})
        if instance.approved:
            raise exceptions.PermissionDenied({'detail': 'Approved expenses cannot be deleted.'})
        if instance.is_claimed:
            raise exceptions.PermissionDenied({'detail': 'This expense has been claimed and cannot be deleted.'})
        instance.delete()


class WorkerClaimViewSet(viewsets.ModelViewSet):
    queryset = WorkerClaim.objects.all()
    serializer_class = WorkerClaimSerializer
    pagination_class = FinancePagination

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

        if not user.is_superuser and not getattr(user, 'is_staff', False) and not is_management and not user.has_perm('finance.approve_workerclaim'):
            from django.db.models import Q
            queryset = queryset.filter(Q(worker=user) | Q(submitted_by=user))

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        worker_param = self.request.query_params.get("worker")
        if worker_param:
            queryset = queryset.filter(worker_id=worker_param)

        return queryset

    @action(detail=False, methods=['post'], url_path='create-bundle')
    def create_bundle(self, request):
        worker_id = request.data.get('worker_id')
        expense_ids = request.data.get('expense_ids', [])
        period_from = request.data.get('period_from')
        period_to = request.data.get('period_to')
        remarks = request.data.get('remarks')

        from apps.accounts.models import CustomUser
        from django.core.exceptions import ValidationError as DjangoValidationError

        worker = CustomUser.objects.filter(pk=worker_id).first() if worker_id else None

        try:
            bundle = BundleService.create_bundle(
                worker=worker,
                expense_ids=expense_ids,
                period_from=period_from,
                period_to=period_to,
                remarks=remarks,
                created_by=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(WorkerClaimSerializer(bundle).data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=True, methods=['post', 'put', 'patch'], url_path='update-bundle')
    def update_bundle(self, request, pk=None):
        expense_ids = request.data.get('expense_ids')
        period_from = request.data.get('period_from')
        period_to = request.data.get('period_to')
        remarks = request.data.get('remarks')

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            bundle = BundleService.update_bundle(
                bundle_id=pk,
                expense_ids=expense_ids,
                period_from=period_from,
                period_to=period_to,
                remarks=remarks,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(WorkerClaimSerializer(bundle).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_bundle(self, request, pk=None):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            bundle = BundleService.submit_bundle(
                bundle_id=pk,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(WorkerClaimSerializer(bundle).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})


    def perform_destroy(self, instance):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            BundleService.delete_bundle(
                bundle_id=instance.pk,
                actor=user,
                ip_address=self.request.META.get('REMOTE_ADDR')
            )
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})


class LedgerGroupViewSet(viewsets.ModelViewSet):
    queryset = LedgerGroup.objects.all()
    serializer_class = LedgerGroupSerializer


class LedgerViewSet(viewsets.ModelViewSet):
    queryset = Ledger.objects.all()
    serializer_class = LedgerSerializer
    pagination_class = FinancePagination

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return LedgerWriteSerializer
        return LedgerSerializer

    def perform_create(self, serializer):
        bundle_ids = serializer.validated_data.pop('bundle_ids', [])
        ledger_group = serializer.validated_data.get('ledger_group')
        remarks = serializer.validated_data.get('remarks')

        ledger = LedgerService.create_ledger(
            bundle_ids=bundle_ids,
            created_by=self.request.user,
            ledger_group_id=ledger_group.ledger_group_id if ledger_group else None,
            remarks=remarks,
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        return ledger

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_ledger(self, request, pk=None):
        ledger = LedgerService.submit_ledger(
            ledger_id=pk,
            actor=request.user,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response(LedgerSerializer(ledger).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='add-expense')
    def add_expense(self, request, pk=None):
        expense_id = request.data.get('expense_id')
        if not expense_id:
            raise exceptions.ValidationError({'detail': 'expense_id is required'})
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            ledger = LedgerService.add_expense(
                ledger_id=pk,
                expense_id=expense_id,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(LedgerSerializer(ledger).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=True, methods=['post'], url_path='remove-expense')
    def remove_expense(self, request, pk=None):
        expense_id = request.data.get('expense_id')
        if not expense_id:
            raise exceptions.ValidationError({'detail': 'expense_id is required'})
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            ledger = LedgerService.remove_expense(
                ledger_id=pk,
                expense_id=expense_id,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(LedgerSerializer(ledger).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=True, methods=['post'], url_path='add-bundle')
    def add_bundle(self, request, pk=None):
        bundle_id = request.data.get('bundle_id')
        if not bundle_id:
            raise exceptions.ValidationError({'detail': 'bundle_id is required'})
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            ledger = LedgerService.add_bundle(
                ledger_id=pk,
                bundle_id=bundle_id,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(LedgerSerializer(ledger).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=True, methods=['post'], url_path='remove-bundle')
    def remove_bundle(self, request, pk=None):
        bundle_id = request.data.get('bundle_id')
        if not bundle_id:
            raise exceptions.ValidationError({'detail': 'bundle_id is required'})
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            ledger = LedgerService.remove_bundle(
                ledger_id=pk,
                bundle_id=bundle_id,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(LedgerSerializer(ledger).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=False, methods=['get'], url_path='available-approved-bundles')
    def available_approved_bundles(self, request):
        qs = WorkerClaim.objects.filter(status='Approved', ledgers__isnull=True)
        return Response(WorkerClaimSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='available-approved-expenses')
    def available_approved_expenses(self, request):
        store_id = request.query_params.get('store_id')
        qs = Expense.objects.filter(approved=True, ledgers__isnull=True)
        if store_id:
            from django.db.models import Q
            qs = qs.filter(Q(responsible_store_id=store_id) | Q(ticket__store_id=store_id))
        return Response(ExpenseSerializer(qs, many=True).data)

    def perform_destroy(self, instance):
        user = self.request.user
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '') if user else ''
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)] if user else []
        if role_name in ('management', 'management team') or 'management' in user_groups_lower:
            raise exceptions.PermissionDenied({'detail': 'Management role is view-only.'})

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            LedgerService.delete_ledger(
                ledger_id=instance.pk,
                actor=user,
                ip_address=self.request.META.get('REMOTE_ADDR')
            )
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})


class ApprovalWorkflowViewSet(viewsets.ModelViewSet):
    queryset = ApprovalWorkflow.objects.all()
    serializer_class = ApprovalWorkflowSerializer


class ApprovalStepViewSet(viewsets.ModelViewSet):
    queryset = ApprovalStep.objects.all()
    serializer_class = ApprovalStepSerializer


class ApprovalInstanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ApprovalInstance.objects.all()
    serializer_class = ApprovalInstanceSerializer
    pagination_class = FinancePagination

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return ApprovalInstance.objects.none()

        my_role_only = self.request.query_params.get("assigned_to_me")
        if my_role_only is not None and my_role_only.lower() in ('true', '1', 'yes'):
            if hasattr(user, 'role') and user.role:
                queryset = queryset.filter(step__assigned_role=user.role)
            else:
                return ApprovalInstance.objects.none()

        return queryset

    @action(detail=True, methods=['post'], url_path='action')
    def action_step(self, request, pk=None):
        action_name = request.data.get('action') # 'APPROVED', 'REJECTED', 'REWORK'
        comments = request.data.get('comments')

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            instance = ApprovalService.action_step(
                instance_id=pk,
                actor=request.user,
                action=action_name,
                comments=comments,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(ApprovalInstanceSerializer(instance).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.all()
    serializer_class = AuditEventSerializer
    pagination_class = FinancePagination


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    pagination_class = FinancePagination

    @action(detail=False, methods=['post'], url_path='process-payment')
    def process_payment(self, request):
        payment_method = request.data.get('payment_method', 'Cash')
        amount_paid = request.data.get('amount_paid')
        bundle_id = request.data.get('bundle_id')
        ledger_id = request.data.get('ledger_id')
        expense_id = request.data.get('expense_id')
        transaction_reference = request.data.get('transaction_reference')
        remarks = request.data.get('remarks')

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            payment = PaymentService.process_payment(
                actor=request.user,
                payment_method=payment_method,
                amount_paid=amount_paid,
                bundle_id=bundle_id,
                ledger_id=ledger_id,
                expense_id=expense_id,
                transaction_reference=transaction_reference,
                remarks=remarks,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})


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
