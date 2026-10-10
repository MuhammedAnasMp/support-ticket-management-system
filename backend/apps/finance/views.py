from django.db.models import Q, Prefetch, Count
from django.utils import timezone
from rest_framework import viewsets, exceptions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from decimal import Decimal

from .models import (
    ExpenseType, EmployeeRate, Expense, Reconciliation, WorkerClaim,
    LedgerBatch, LedgerGroup, Ledger, ApprovalWorkflow, ApprovalStep,
    ApprovalInstance, AuditEvent, Payment
)
from .serializers import (
    ExpenseTypeSerializer, EmployeeRateSerializer, ExpenseSerializer,
    ReconciliationSerializer, ExpenseWriteSerializer, ExpenseTypeWriteSerializer,
    WorkerClaimSerializer, WorkerClaimWriteSerializer,
    LedgerBatchSerializer, LedgerBatchWriteSerializer,
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
    queryset = ExpenseType.objects.all().select_related('parent', 'department')
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
    queryset = EmployeeRate.objects.all().select_related('worker', 'worker__role')
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
    queryset = Expense.objects.all().order_by('-expense_date', '-expense_id')
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

        status_param = self.request.query_params.get("status")
        if status_param and status_param.upper() != 'ALL':
            status_lower = status_param.lower().strip()
            if status_lower == 'approved':
                queryset = queryset.filter(Q(approved=True) | Q(expense_type__approve_required=False))
            elif status_lower in ('pending approval', 'pending', 'in review'):
                queryset = queryset.filter(approved=False, expense_type__approve_required=True)
            elif status_lower == 'rejected':
                queryset = queryset.filter(approval_instances__status='Rejected')
            elif status_lower == 'rework':
                queryset = queryset.filter(approval_instances__status='Rework')
            elif status_lower == 'paid':
                queryset = queryset.filter(claim__status='Paid')

        from_date = self.request.query_params.get("from_date") or self.request.query_params.get("date_from")
        if from_date:
            queryset = queryset.filter(expense_date__gte=from_date)

        to_date = self.request.query_params.get("to_date") or self.request.query_params.get("date_to")
        if to_date:
            queryset = queryset.filter(expense_date__lte=to_date)

        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search:
            search = search.strip()
            q_search = (
                Q(expense_type__expense_name__icontains=search) |
                Q(worker__first_name__icontains=search) |
                Q(worker__last_name__icontains=search) |
                Q(worker__username__icontains=search) |
                Q(remarks__icontains=search) |
                Q(ticket__work_order_no__icontains=search) |
                Q(ticket__title__icontains=search) |
                Q(responsible_store__store_name__icontains=search)
            )
            if search.isdigit():
                q_search |= Q(expense_id=int(search)) | Q(ticket_id=int(search))
            try:
                amt_val = float(search)
                q_search |= Q(amount=amt_val)
            except ValueError:
                pass
            queryset = queryset.filter(q_search)

        worker = self.request.query_params.get("worker")
        if worker:
            queryset = queryset.filter(worker_id=worker)

        return queryset.select_related(
            'worker',
            'worker__role',
            'ticket',
            'ticket__store',
            'ticket__nature__sub_department__department',
            'ticket__department',
            'ticket__status',
            'expense_type',
            'expense_type__department',
            'responsible_store',
            'added_by',
            'claim'
        ).prefetch_related(
            'receipts',
            'approval_instances__step__assigned_role',
            'approval_instances__step__assigned_users',
            'approval_instances__action_by'
        ).order_by('-expense_date', '-expense_id')

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
        if expense.is_claimed or expense.claim:
            raise exceptions.PermissionDenied({'detail': 'This expense is attached to a claim bundle and cannot be modified directly. Remove it from the bundle first.'})

        has_rejected_or_rework = expense.approval_instances.filter(status__in=['Rejected', 'Rework']).exists()
        has_pending = expense.approval_instances.filter(status='Pending').exists()
        approve_required = bool(expense.expense_type and expense.expense_type.approve_required)

        # In review: not approved, requires approval, and not currently in Rework or Rejected
        is_in_review = not expense.approved and approve_required and not has_rejected_or_rework and has_pending
        if is_in_review:
            raise exceptions.PermissionDenied({'detail': 'Expenses currently under review / pending approval cannot be modified. Please wait for an approval decision or request rework.'})

        updated_expense = serializer.save()

        # If the expense requires approval, reset its approved status to False and restart/move to approval workflow
        if updated_expense.expense_type and updated_expense.expense_type.approve_required:
            updated_expense.approved = False
            updated_expense.approved_by = None
            updated_expense.save(update_fields=['approved', 'approved_by'])
            # Clean up unhandled pending approval instances while preserving history
            updated_expense.approval_instances.filter(status='Pending').delete()
            wf = ApprovalWorkflow.objects.filter(entity_type='Expense', is_active=True).first()
            if wf:
                ApprovalService.start_workflow(updated_expense, user, ip_address=self.request.META.get('REMOTE_ADDR'))
        else:
            updated_expense.approved = True
            updated_expense.approved_by = user
            updated_expense.save(update_fields=['approved', 'approved_by'])

    @action(detail=True, methods=['post'], url_path='action')
    def action_expense(self, request, pk=None):
        expense = self.get_object()
        action_name = request.data.get('action', 'APPROVED') # 'APPROVED', 'REJECTED', 'REWORK'
        comments = request.data.get('comments')
        user = request.user

        pending_instance = expense.approval_instances.filter(status='Pending').order_by('created_at').first()
        if pending_instance:
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                instance = ApprovalService.action_step(
                    instance_id=pending_instance.instance_id,
                    actor=user,
                    action=action_name,
                    comments=comments,
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                return Response({'status': 'success', 'approval': ApprovalInstanceSerializer(instance).data, 'expense': ExpenseSerializer(expense).data}, status=status.HTTP_200_OK)
            except DjangoValidationError as e:
                msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
                raise exceptions.ValidationError({'detail': msg})

        is_admin = user.is_superuser or getattr(user, 'is_staff', False) or (hasattr(user, 'role') and user.role and user.role.role_name.lower() in ('administrator', 'admin'))
        if not is_admin and not user.has_perm('finance.approve_expense') and not user.has_perm('finance.approve_expense', expense):
            raise exceptions.PermissionDenied({'detail': 'You do not have permission to approve this expense.'})

        if action_name == 'APPROVED':
            expense.approved = True
            expense.approved_by = user
            expense.save(update_fields=['approved', 'approved_by'])
            create_audit_event('Expense', expense.pk, 'MANUALLY_APPROVED', actor=user, payload={'comments': comments}, ip_address=request.META.get('REMOTE_ADDR'))
        elif action_name == 'REWORK':
            expense.approved = False
            expense.save(update_fields=['approved'])
            # Reset workflow to first step (Step 1) while preserving history
            expense.approval_instances.filter(status='Pending').delete()
            wf = ApprovalWorkflow.objects.filter(entity_type='Expense', is_active=True).first()
            if wf:
                ApprovalService.start_workflow(expense, user, ip_address=request.META.get('REMOTE_ADDR'))
            create_audit_event('Expense', expense.pk, 'MANUALLY_REWORK', actor=user, payload={'comments': comments}, ip_address=request.META.get('REMOTE_ADDR'))
        elif action_name == 'REJECTED':
            expense.approved = False
            expense.save(update_fields=['approved'])
            create_audit_event('Expense', expense.pk, 'MANUALLY_REJECTED', actor=user, payload={'comments': comments}, ip_address=request.META.get('REMOTE_ADDR'))

        return Response({'status': 'success', 'expense': ExpenseSerializer(expense).data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk-approve')
    def bulk_approve_expenses(self, request):
        expense_ids = request.data.get('expense_ids', [])
        comments = request.data.get('comments', 'Bulk approved')
        user = request.user

        if not expense_ids or not isinstance(expense_ids, list):
            raise exceptions.ValidationError({'detail': 'expense_ids list is required.'})

        success_count = 0
        errors = []

        from django.core.exceptions import ValidationError as DjangoValidationError

        for exp_id in expense_ids:
            try:
                expense = Expense.objects.filter(pk=exp_id).first()
                if not expense:
                    errors.append(f"Expense #{exp_id} not found.")
                    continue

                if expense.approved:
                    continue

                # Check if there is an active approval instance
                pending_instance = expense.approval_instances.filter(status='Pending').order_by('created_at').first()
                if pending_instance:
                    ApprovalService.action_step(
                        instance_id=pending_instance.instance_id,
                        actor=user,
                        action='APPROVED',
                        comments=comments,
                        ip_address=request.META.get('REMOTE_ADDR')
                    )
                    success_count += 1
                else:
                    # Direct approval if authorized
                    is_admin = user.is_superuser or (hasattr(user, 'role') and user.role and user.role.role_name.lower().strip() == 'administrator')
                    if not is_admin and not user.has_perm('finance.approve_expense') and not user.has_perm('finance.approve_expense', expense):
                        errors.append(f"Expense #{exp_id}: You do not have permission to approve.")
                        continue
                    expense.approved = True
                    expense.approved_by = user
                    expense.save(update_fields=['approved', 'approved_by'])
                    create_audit_event('Expense', expense.pk, 'MANUALLY_APPROVED', actor=user, payload={'comments': comments, 'bulk': True}, ip_address=request.META.get('REMOTE_ADDR'))
                    success_count += 1
            except DjangoValidationError as e:
                msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
                errors.append(f"Expense #{exp_id}: {msg}")
            except Exception as e:
                errors.append(f"Expense #{exp_id}: {str(e)}")

        return Response({
            'status': 'success',
            'approved_count': success_count,
            'errors': errors
        }, status=status.HTTP_200_OK)

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
        
        is_management_or_admin = (
            role_name in (
                'management', 'management team', 'administrator', 'admin',
                'office administrator', 'finance', 'accountant', 'auditor'
            ) or any(g in user_groups_lower for g in ('management', 'administrator', 'admin', 'office administrator', 'finance', 'accountant'))
        )

        has_claim_perms = (
            user.has_perm('finance.approve_workerclaim') or
            user.has_perm('finance.view_workerclaim') or
            user.has_perm('finance.change_workerclaim') or
            user.has_perm('finance.create_bundle') or
            user.has_perm('finance.submit_bundle')
        )

        from apps.finance.models import ApprovalStep
        is_workflow_approver = ApprovalStep.objects.filter(
            workflow__entity_type='Bundle', workflow__is_active=True
        ).filter(
            Q(assigned_users=user) | (Q(assigned_role=user.role) if getattr(user, 'role', None) else Q())
        ).exists()

        if not user.is_superuser and not getattr(user, 'is_staff', False) and not is_management_or_admin and not has_claim_perms and not is_workflow_approver:
            q_filter = Q(worker=user) | Q(submitted_by=user)
            q_filter |= Q(approval_instances__step__assigned_users=user)
            if hasattr(user, 'role') and user.role:
                q_filter |= Q(approval_instances__step__assigned_role=user.role)

            try:
                from guardian.shortcuts import get_objects_for_user
                claim_pks = get_objects_for_user(user, 'finance.approve_workerclaim', accept_global_perms=False).values_list('pk', flat=True)
                if claim_pks:
                    q_filter |= Q(claim_id__in=claim_pks)
                claim_view_pks = get_objects_for_user(user, 'finance.view_workerclaim', accept_global_perms=False).values_list('pk', flat=True)
                if claim_view_pks:
                    q_filter |= Q(claim_id__in=claim_view_pks)
            except Exception:
                pass

            queryset = queryset.filter(q_filter).distinct()

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        status_param = self.request.query_params.get("status")
        if status_param and status_param.upper() != 'ALL':
            queryset = queryset.filter(status=status_param)

        ledger_filter = self.request.query_params.get("ledger_filter")
        if ledger_filter:
            if ledger_filter.upper() == 'IN_LEDGER':
                queryset = queryset.filter(ledger__isnull=False)
            elif ledger_filter.upper() == 'NOT_IN_LEDGER':
                queryset = queryset.filter(ledger__isnull=True)

        from_date = self.request.query_params.get("from_date") or self.request.query_params.get("date_from")
        if from_date:
            queryset = queryset.filter(claim_date__date__gte=from_date)

        to_date = self.request.query_params.get("to_date") or self.request.query_params.get("date_to")
        if to_date:
            queryset = queryset.filter(claim_date__date__lte=to_date)

        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search:
            search = search.strip()
            q_search = (
                Q(worker__first_name__icontains=search) |
                Q(worker__last_name__icontains=search) |
                Q(worker__username__icontains=search) |
                Q(ticket__work_order_no__icontains=search) |
                Q(remarks__icontains=search) |
                Q(ledger__ledger_group__group_name__icontains=search)
            )
            if search.isdigit():
                q_search |= Q(claim_id=int(search))
            queryset = queryset.filter(q_search)

        worker_param = self.request.query_params.get("worker")
        if worker_param:
            queryset = queryset.filter(worker_id=worker_param)

        return queryset.select_related(
            'worker',
            'worker__role',
            'submitted_by',
            'submitted_by__role',
            'approved_by',
            'approved_by__role',
            'ticket',
            'ticket__store',
            'ticket__nature__sub_department__department',
            'ticket__department',
            'ticket__status'
        ).prefetch_related(
            'ledgers__ledger_group',
            Prefetch(
                'expenses',
                queryset=Expense.objects.select_related(
                    'worker',
                    'worker__role',
                    'ticket',
                    'ticket__store',
                    'ticket__nature__sub_department__department',
                    'ticket__department',
                    'ticket__status',
                    'expense_type',
                    'expense_type__department',
                    'responsible_store',
                    'added_by',
                    'claim'
                ).prefetch_related(
                    'receipts',
                    'approval_instances__step__assigned_role',
                    'approval_instances__step__assigned_users',
                    'approval_instances__action_by'
                )
            ),
            'approval_instances__step__assigned_role',
            'approval_instances__step__assigned_users',
            'approval_instances__action_by'
        ).order_by('-claim_date', '-claim_id')

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

    @action(detail=True, methods=['post'], url_path='remove-expense')
    def remove_expense(self, request, pk=None):
        expense_id = request.data.get('expense_id')
        if not expense_id:
            raise exceptions.ValidationError({'detail': 'expense_id is required'})
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            bundle = BundleService.remove_expense_from_bundle(
                bundle_id=pk,
                expense_id=expense_id,
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
    queryset = LedgerGroup.objects.all().prefetch_related('ledgers').order_by('-created_at')
    serializer_class = LedgerGroupSerializer
    pagination_class = FinancePagination

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            search = search.strip()
            if search.isdigit():
                queryset = queryset.filter(Q(group_name__icontains=search) | Q(ledger_group_id=int(search)))
            else:
                queryset = queryset.filter(group_name__icontains=search)
        return queryset.annotate(
            annotated_ledgers_count=Count('ledgers', distinct=True)
        ).select_related(
            'created_by', 'created_by__role', 'completed_by', 'completed_by__role'
        ).prefetch_related('ledgers')

    def perform_destroy(self, instance):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            LedgerService.delete_group(
                group_id=instance.ledger_group_id,
                actor=self.request.user,
                ip_address=self.request.META.get('REMOTE_ADDR')
            )
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_group(self, request, pk=None):
        group = self.get_object()
        # Verify all ledgers in this group are approved
        unapproved = group.ledgers.exclude(status__in=['Approved', 'Paid'])
        if unapproved.exists():
            return Response(
                {'detail': f'Cannot complete Ledger Group. {unapproved.count()} ledger batch(es) are not yet approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        group.is_completed = True
        group.completed_at = timezone.now()
        if request.user and request.user.is_authenticated:
            group.completed_by = request.user
        group.save(update_fields=['is_completed', 'completed_at', 'completed_by'])

        serializer = self.get_serializer(group)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_group(self, request, pk=None):
        group = self.get_object()

        # Clean up any empty draft ledgers with 0 bundles and 0 expenses
        empty_drafts = group.ledgers.filter(status='Draft', total_amount=0, bundles__isnull=True, expenses__isnull=True)
        if empty_drafts.exists():
            empty_drafts.delete()

        ledgers_to_submit = group.ledgers.filter(status__in=['Draft', 'Rework', 'Rejected'])
        if not ledgers_to_submit.exists():
            all_approved = group.ledgers.filter(status__in=['Approved', 'Paid']).count() == group.ledgers.count() and group.ledgers.exists()
            if all_approved:
                return Response(
                    {'detail': f"All batches in Ledger Group '{group.group_name}' are already Approved."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'detail': 'No draft or rework batches found in this Ledger Group to submit.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        has_attached_bundles = any(l.bundles.exists() or l.expenses.exists() for l in ledgers_to_submit)
        if not has_attached_bundles:
            return Response(
                {'detail': f"Cannot submit Ledger Group '{group.group_name}': Must have at least one claim bundle attached."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            for ledger in ledgers_to_submit:
                if ledger.bundles.exists() or ledger.expenses.exists():
                    LedgerService.submit_ledger(ledger.ledger_id, request.user, ip_address=request.META.get('REMOTE_ADDR'))
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

        updated_ledgers = list(group.ledgers.all())
        return Response(LedgerSerializer(updated_ledgers, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='action')
    def action_group(self, request, pk=None):
        group = self.get_object()
        action_name = request.data.get('action')
        comments = request.data.get('comments')

        if action_name not in ['APPROVED', 'REJECTED', 'REWORK']:
            return Response({'detail': f"Invalid action '{action_name}'."}, status=status.HTTP_400_BAD_REQUEST)

        if action_name == 'REWORK' and not (comments and str(comments).strip()):
            return Response({'detail': "A reason or comment is required when requesting rework."}, status=status.HTTP_400_BAD_REQUEST)

        pending_instances = ApprovalInstance.objects.filter(
            ledger__ledger_group=group,
            status='Pending'
        ).select_related('step', 'ledger')

        if not pending_instances.exists():
            return Response({'detail': 'No pending approval steps found for this Ledger Group.'}, status=status.HTTP_400_BAD_REQUEST)

        actioned_count = 0
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            for inst in list(pending_instances):
                if ApprovalService.can_user_action_step(request.user, inst.step, inst):
                    ApprovalService.action_step(
                        instance_id=inst.instance_id,
                        actor=request.user,
                        action=action_name,
                        comments=comments,
                        ip_address=request.META.get('REMOTE_ADDR')
                    )
                    actioned_count += 1
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

        if actioned_count == 0:
            return Response({'detail': 'You are not authorized to action the pending approval step for this Ledger Group.'}, status=status.HTTP_403_FORBIDDEN)

        updated_ledgers = list(group.ledgers.all())
        return Response(LedgerSerializer(updated_ledgers, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='add-bundle')
    def add_bundle(self, request, pk=None):
        bundle_ids = request.data.get('bundle_ids')
        bundle_id = request.data.get('bundle_id')
        if not bundle_ids and not bundle_id:
            raise exceptions.ValidationError({'detail': 'bundle_id or bundle_ids is required'})
        
        target_ids = bundle_ids if isinstance(bundle_ids, list) else [bundle_id]
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            group = None
            for b_id in target_ids:
                group = LedgerService.add_bundle_to_group(
                    ledger_group_id=pk,
                    bundle_id=b_id,
                    actor=request.user,
                    ip_address=request.META.get('REMOTE_ADDR')
                )
            updated_ledgers = list(group.ledgers.all()) if group else []
            return Response(LedgerSerializer(updated_ledgers, many=True).data, status=status.HTTP_200_OK)
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
            group = LedgerService.remove_bundle_from_group(
                group_id=pk,
                bundle_id=bundle_id,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            updated_ledgers = list(group.ledgers.all())
            return Response(LedgerSerializer(updated_ledgers, many=True).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})


class LedgerViewSet(viewsets.ModelViewSet):
    queryset = Ledger.objects.all()
    serializer_class = LedgerSerializer
    pagination_class = FinancePagination

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return LedgerWriteSerializer
        return LedgerSerializer

    def get_queryset(self):
        queryset = Ledger.objects.all()

        status_param = self.request.query_params.get("status")
        if status_param and status_param.upper() != 'ALL':
            queryset = queryset.filter(status=status_param)

        from_date = self.request.query_params.get("from_date") or self.request.query_params.get("date_from")
        if from_date:
            queryset = queryset.filter(created_at__date__gte=from_date)

        to_date = self.request.query_params.get("to_date") or self.request.query_params.get("date_to")
        if to_date:
            queryset = queryset.filter(created_at__date__lte=to_date)

        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search:
            search = search.strip()
            q_search = (
                Q(ledger_group__group_name__icontains=search) |
                Q(created_by__first_name__icontains=search) |
                Q(created_by__last_name__icontains=search) |
                Q(created_by__username__icontains=search)
            )
            if search.isdigit():
                q_search |= Q(ledger_id=int(search))
            queryset = queryset.filter(q_search)

        return queryset.select_related(
            'ledger_group',
            'ledger_group__created_by',
            'ledger_group__completed_by',
            'ledger_batch',
            'created_by',
            'created_by__role',
            'store'
        ).prefetch_related(
            Prefetch(
                'expenses',
                queryset=Expense.objects.select_related(
                    'worker', 'worker__role', 'ticket', 'ticket__store', 'ticket__nature__sub_department__department',
                    'ticket__department', 'ticket__status', 'expense_type', 'expense_type__department', 'responsible_store', 'added_by', 'claim'
                ).prefetch_related('receipts')
            ),
            Prefetch(
                'bundles',
                queryset=WorkerClaim.objects.select_related(
                    'worker', 'worker__role', 'submitted_by', 'approved_by', 'ticket', 'ticket__store', 'ticket__status'
                ).prefetch_related(
                    Prefetch(
                        'expenses',
                        queryset=Expense.objects.select_related(
                            'worker', 'worker__role', 'ticket', 'ticket__store', 'ticket__nature__sub_department__department',
                            'ticket__department', 'ticket__status', 'expense_type', 'expense_type__department', 'responsible_store', 'added_by'
                        ).prefetch_related('receipts')
                    ),
                    'approval_instances__step__assigned_role',
                    'approval_instances__action_by'
                )
            ),
            'approval_instances__step__assigned_role',
            'approval_instances__step__assigned_users',
            'approval_instances__action_by',
            'ledger_batch__sub_departments__department'
        ).order_by('-created_at', '-ledger_id')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bundle_ids = serializer.validated_data.get('bundle_ids', [])
        ledger_group = serializer.validated_data.get('ledger_group')
        remarks = serializer.validated_data.get('remarks')

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            ledgers = LedgerService.create_ledger(
                bundle_ids=bundle_ids,
                created_by=request.user,
                ledger_group_id=ledger_group.ledger_group_id if ledger_group else None,
                remarks=remarks,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            if isinstance(ledgers, list):
                if len(ledgers) == 1:
                    return Response(LedgerSerializer(ledgers[0]).data, status=status.HTTP_201_CREATED)
                return Response(LedgerSerializer(ledgers, many=True).data, status=status.HTTP_201_CREATED)
            return Response(LedgerSerializer(ledgers).data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_ledger(self, request, pk=None):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            ledger = LedgerService.submit_ledger(
                ledger_id=pk,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(LedgerSerializer(ledger).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})

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

    @action(detail=True, methods=['post'], url_path='change-group')
    def change_group(self, request, pk=None):
        ledger_group_id = request.data.get('ledger_group_id')
        new_group_name = request.data.get('new_group_name') or request.data.get('new_ledger_group_name')

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            ledger = LedgerService.change_ledger_group(
                ledger_id=pk,
                ledger_group_id=ledger_group_id,
                new_group_name=new_group_name,
                actor=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(LedgerSerializer(ledger).data, status=status.HTTP_200_OK)
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
            if user.is_superuser:
                return queryset

            from django.db.models import Q
            q_filter = Q(step__assigned_users=user)
            if hasattr(user, 'role') and user.role:
                q_filter |= Q(step__assigned_role=user.role)

            try:
                from guardian.shortcuts import get_objects_for_user
                claim_pks = get_objects_for_user(user, 'finance.approve_workerclaim', accept_global_perms=False).values_list('pk', flat=True)
                if claim_pks:
                    q_filter |= Q(claim_id__in=claim_pks)

                expense_pks = get_objects_for_user(user, 'finance.approve_expense', accept_global_perms=False).values_list('pk', flat=True)
                if expense_pks:
                    q_filter |= Q(expense_id__in=expense_pks)

                ledger_pks = get_objects_for_user(user, 'finance.approve_ledger', accept_global_perms=False).values_list('pk', flat=True)
                if ledger_pks:
                    q_filter |= Q(ledger_id__in=ledger_pks)
            except Exception:
                pass

            if user.has_perm('finance.approve_workerclaim'):
                q_filter |= Q(claim__isnull=False)
            if user.has_perm('finance.approve_expense'):
                q_filter |= Q(expense__isnull=False)
            if user.has_perm('finance.approve_ledger'):
                q_filter |= Q(ledger__isnull=False)

            queryset = queryset.filter(q_filter).distinct()

        return queryset.select_related(
            'step', 'step__workflow', 'step__assigned_role', 'action_by', 'action_by__role',
            'claim', 'claim__worker', 'claim__ticket', 'claim__ticket__store',
            'ledger', 'ledger__ledger_group', 'ledger__store',
            'expense', 'expense__worker', 'expense__ticket', 'expense__ticket__store', 'expense__expense_type', 'expense__responsible_store'
        ).prefetch_related(
            'step__assigned_users',
            'step__workflow__steps__assigned_role',
            'step__workflow__steps__assigned_users',
            'claim__expenses__receipts',
            'claim__expenses__expense_type',
            'claim__expenses__ticket',
            'claim__expenses__responsible_store',
            'claim__expenses__worker',
            'ledger__bundles__worker',
            'ledger__bundles__ticket',
            'ledger__bundles__expenses__receipts',
            'ledger__bundles__expenses__expense_type',
            'ledger__bundles__expenses__responsible_store',
            'ledger__bundles__expenses__worker',
            'ledger__expenses__receipts',
            'ledger__expenses__expense_type',
            'ledger__expenses__responsible_store',
            'ledger__expenses__worker',
            'expense__receipts'
        ).order_by('-created_at', '-instance_id')

    @action(detail=True, methods=['post'], url_path='action')
    def action_step(self, request, pk=None):
        action_name = request.data.get('action') # 'APPROVED', 'REJECTED', 'REWORK'
        comments = request.data.get('comments')
        ledger_group_id = request.data.get('ledger_group_id')
        new_group_name = request.data.get('new_group_name') or request.data.get('new_ledger_group_name')

        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            instance = ApprovalService.action_step(
                instance_id=pk,
                actor=request.user,
                action=action_name,
                comments=comments,
                ledger_group_id=ledger_group_id,
                new_group_name=new_group_name,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(ApprovalInstanceSerializer(instance).data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise exceptions.ValidationError({'detail': msg})


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.all().select_related('actor', 'actor__role').order_by('-timestamp')
    serializer_class = AuditEventSerializer
    pagination_class = FinancePagination


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().select_related('paid_by', 'paid_by__role', 'claim', 'ledger', 'expense').order_by('-paid_at', '-payment_id')
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


class LedgerBatchViewSet(viewsets.ModelViewSet):
    queryset = LedgerBatch.objects.all().prefetch_related('sub_departments__department')
    serializer_class = LedgerBatchSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return LedgerBatchWriteSerializer
        return LedgerBatchSerializer

