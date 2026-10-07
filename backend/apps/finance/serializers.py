from rest_framework import serializers
from .models import (
    ExpenseType, EmployeeRate, Expense, Reconciliation, WorkerClaim,
    LedgerBatch, LedgerGroup, Ledger, ApprovalWorkflow, ApprovalStep,
    ApprovalInstance, AuditEvent, Payment
)
from apps.common.serializers import MediaSerializer
from apps.accounts.models import CustomUser
from apps.stores.serializers import SubDepartmentSerializer


class ExpenseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseType
        fields = '__all__'
        depth = 1

    def validate(self, data):
        parent = data.get('parent')
        department = data.get('department')
        if parent and department and parent.department != department:
            raise serializers.ValidationError(
                {"parent": f"Parent expense type must belong to the same department ({department.department_name})."}
            )
        return data


class ExpenseTypeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseType
        fields = '__all__'

    def validate(self, data):
        parent = data.get('parent')
        department = data.get('department')
        if parent and department and parent.department != department:
            raise serializers.ValidationError(
                {"parent": f"Parent expense type must belong to the same department ({department.department_name})."}
            )
        return data


class EmployeeRateSerializer(serializers.ModelSerializer):
    worker = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all()
    )

    class Meta:
        model = EmployeeRate
        fields = '__all__'
        depth = 1

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if instance.worker:
            from apps.accounts.serializers import CustomUserSerializer
            rep['worker'] = CustomUserSerializer(instance.worker).data
        else:
            rep['worker'] = None
        return rep


class ExpenseSerializer(serializers.ModelSerializer):
    receipts = MediaSerializer(many=True, read_only=True)
    approval_instances = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    reject_reason = serializers.SerializerMethodField()
    ticket_details = serializers.SerializerMethodField()
    worker_detail = serializers.SerializerMethodField()
    expense_type_detail = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = '__all__'
        depth = 1

    def get_approval_instances(self, obj):
        instances = obj.approval_instances.all().order_by('-created_at')
        return ApprovalInstanceSerializer(instances, many=True).data

    def get_status_display(self, obj):
        insts = list(obj.approval_instances.all().order_by('-created_at'))
        if insts:
            latest_inst = insts[0]
            if latest_inst.status in ['Rejected', 'Rework']:
                return latest_inst.status
        if obj.approved or (obj.expense_type and not obj.expense_type.approve_required):
            return 'Approved'
        if obj.claim and obj.claim.status in ['Rejected', 'Rework']:
            return obj.claim.status
        return 'Pending Approval'

    def get_reject_reason(self, obj):
        insts = list(obj.approval_instances.all().order_by('-created_at'))
        for inst in insts:
            if inst.status in ['Rejected', 'Rework'] and inst.comments:
                return inst.comments
        if obj.claim and obj.claim.reject_reason:
            return obj.claim.reject_reason
        return None

    def get_ticket_details(self, obj):
        if obj.ticket:
            sub_id = None
            sub_name = None
            dept_name = None
            if obj.ticket.nature and obj.ticket.nature.sub_department:
                sub_id = obj.ticket.nature.sub_department.sub_department_id
                sub_name = obj.ticket.nature.sub_department.sub_department_name
                if obj.ticket.nature.sub_department.department:
                    dept_name = obj.ticket.nature.sub_department.department.department_name
            elif obj.ticket.department:
                dept_name = obj.ticket.department.department_name

            return {
                'ticket_id': obj.ticket.ticket_id,
                'work_order_no': obj.ticket.work_order_no,
                'title': obj.ticket.title,
                'store_name': obj.ticket.store.store_name if obj.ticket.store else None,
                'sub_department_id': sub_id,
                'sub_department_name': sub_name,
                'department_name': dept_name,
            }
        return None

    def get_worker_detail(self, obj):
        if obj.worker:
            from apps.accounts.serializers import CustomUserSerializer
            return CustomUserSerializer(obj.worker).data
        return None

    def get_expense_type_detail(self, obj):
        if obj.expense_type:
            return {
                'expense_type_id': obj.expense_type.expense_type_id,
                'expense_id': obj.expense_type.expense_type_id,
                'expense_name': obj.expense_type.expense_name,
                'approve_required': obj.expense_type.approve_required,
                'department_name': obj.expense_type.department.department_name if obj.expense_type.department else None
            }
        return None


class ExpenseWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

    def validate(self, data):
        ticket = data.get('ticket') or (getattr(self.instance, 'ticket', None) if self.instance else None)
        expense_type = data.get('expense_type') or (getattr(self.instance, 'expense_type', None) if self.instance else None)
        if ticket and expense_type and hasattr(ticket, 'department') and hasattr(expense_type, 'department') and ticket.department and expense_type.department and expense_type.department != ticket.department:
            raise serializers.ValidationError(
                {"expense_type": f"Expense Type '{expense_type.expense_name}' does not belong to ticket department '{ticket.department.department_name}'."}
            )
        return data


class WorkerClaimSerializer(serializers.ModelSerializer):
    worker_detail = serializers.SerializerMethodField()
    approved_by_detail = serializers.SerializerMethodField()
    ticket_details = serializers.SerializerMethodField()
    expenses = serializers.SerializerMethodField()
    approval_history = serializers.SerializerMethodField()
    ledger_details = serializers.SerializerMethodField()

    class Meta:
        model = WorkerClaim
        fields = '__all__'

    def get_worker_detail(self, obj):
        if obj.worker:
            from apps.accounts.serializers import CustomUserSerializer
            return CustomUserSerializer(obj.worker).data
        return None

    def get_approved_by_detail(self, obj):
        if obj.approved_by:
            from apps.accounts.serializers import CustomUserSerializer
            return CustomUserSerializer(obj.approved_by).data
        return None

    def get_ticket_details(self, obj):
        if obj.ticket:
            return {
                'ticket_id': obj.ticket.ticket_id,
                'work_order_no': obj.ticket.work_order_no,
                'title': obj.ticket.title,
                'status': obj.ticket.status.status_name if obj.ticket.status else None,
            }
        # Fallback to first expense with a ticket in this bundle
        first_exp = obj.expenses.filter(ticket__isnull=False).select_related(
            'ticket', 'ticket__status').first()
        if first_exp and first_exp.ticket:
            return {
                'ticket_id': first_exp.ticket.ticket_id,
                'work_order_no': first_exp.ticket.work_order_no,
                'title': first_exp.ticket.title,
                'status': first_exp.ticket.status.status_name if first_exp.ticket.status else None,
            }
        return None

    def get_expenses(self, obj):
        return ExpenseSerializer(obj.expenses.all(), many=True).data

    def get_approval_history(self, obj):
        return ApprovalInstanceSerializer(obj.approval_instances.all(), many=True).data

    def get_ledger_details(self, obj):
        ledger = obj.ledgers.first()
        if ledger:
            group_name = ledger.ledger_group.group_name if ledger.ledger_group else f"Ledger Batch #{ledger.ledger_id}"
            return {
                'ledger_id': ledger.ledger_id,
                'group_name': group_name,
                'status': ledger.status,
                'created_at': ledger.created_at.isoformat() if ledger.created_at else None
            }
        return None


class WorkerClaimWriteSerializer(serializers.ModelSerializer):
    expense_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True)

    class Meta:
        model = WorkerClaim
        fields = '__all__'


class ReconciliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reconciliation
        fields = '__all__'
        depth = 1


class LedgerBatchSerializer(serializers.ModelSerializer):
    sub_departments_detail = SubDepartmentSerializer(source='sub_departments', many=True, read_only=True)

    class Meta:
        model = LedgerBatch
        fields = '__all__'


class LedgerBatchWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerBatch
        fields = '__all__'

    def validate_sub_departments(self, sub_departments):
        instance = self.instance
        instance_pk = instance.pk if instance else None

        for subdept in sub_departments:
            existing_batch = LedgerBatch.objects.exclude(pk=instance_pk).filter(sub_departments=subdept).first()
            if existing_batch:
                raise serializers.ValidationError(
                    f"Sub-department '{subdept.sub_department_name}' is already assigned to Ledger Batch '{existing_batch.batch_name}'. A sub-department cannot belong to multiple Ledger Batches."
                )
        return sub_departments


class LedgerGroupSerializer(serializers.ModelSerializer):
    created_by_detail = serializers.SerializerMethodField()
    completed_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = LedgerGroup
        fields = '__all__'

    def get_created_by_detail(self, obj):
        if obj.created_by:
            from apps.accounts.serializers import CustomUserSerializer
            return CustomUserSerializer(obj.created_by).data
        return None

    def get_completed_by_detail(self, obj):
        if obj.completed_by:
            from apps.accounts.serializers import CustomUserSerializer
            return CustomUserSerializer(obj.completed_by).data
        return None


class LedgerSerializer(serializers.ModelSerializer):
    bundles = WorkerClaimSerializer(many=True, read_only=True)
    expenses = ExpenseSerializer(many=True, read_only=True)
    created_by_detail = serializers.SerializerMethodField()
    ledger_group_detail = LedgerGroupSerializer(
        source='ledger_group', read_only=True)
    ledger_batch_detail = LedgerBatchSerializer(
        source='ledger_batch', read_only=True)
    store_detail = serializers.SerializerMethodField()
    approval_history = serializers.SerializerMethodField()

    class Meta:
        model = Ledger
        fields = '__all__'

    def get_created_by_detail(self, obj):
        if obj.created_by:
            from apps.accounts.serializers import CustomUserSerializer
            return CustomUserSerializer(obj.created_by).data
        return None

    def get_store_detail(self, obj):
        if obj.store:
            from apps.stores.serializers import StoreSerializer
            return StoreSerializer(obj.store).data
        return None

    def get_approval_history(self, obj):
        return ApprovalInstanceSerializer(obj.approval_instances.all(), many=True).data


class LedgerWriteSerializer(serializers.ModelSerializer):
    bundle_ids = serializers.ListField(
        child=serializers.IntegerField(), required=True, write_only=True)

    class Meta:
        model = Ledger
        fields = '__all__'


class ApprovalStepSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(
        source='assigned_role.role_name', read_only=True)
    assigned_users_detail = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalStep
        fields = '__all__'

    def validate(self, attrs):
        assigned_role = attrs.get('assigned_role')
        assigned_users = attrs.get('assigned_users')
        if assigned_role and assigned_users:
            raise serializers.ValidationError("Please specify either Assigned Role (Role-wise) OR Assigned Users (User-wise), but not both.")
        return attrs

    def get_assigned_users_detail(self, obj):
        return [
            {
                'user_id': u.pk,
                'username': u.username,
                'full_name': getattr(u, 'full_name', '') or u.username
            }
            for u in obj.assigned_users.all()
        ]


class ApprovalWorkflowSerializer(serializers.ModelSerializer):
    steps = ApprovalStepSerializer(many=True, read_only=True)

    class Meta:
        model = ApprovalWorkflow
        fields = '__all__'


class ApprovalInstanceSerializer(serializers.ModelSerializer):
    step_name = serializers.CharField(source='step.step_name', read_only=True)
    step_order = serializers.IntegerField(
        source='step.step_order', read_only=True)
    assigned_role_name = serializers.CharField(
        source='step.assigned_role.role_name', read_only=True)
    action_by_username = serializers.CharField(
        source='action_by.username', read_only=True)
    action_by_full_name = serializers.SerializerMethodField()
    target_summary = serializers.SerializerMethodField()
    workflow_steps = serializers.SerializerMethodField()
    approval_history = serializers.SerializerMethodField()
    can_action = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalInstance
        fields = '__all__'

    def get_action_by_full_name(self, obj):
        if obj.action_by:
            return obj.action_by.full_name or obj.action_by.username
        return None

    def get_can_action(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        from .services import ApprovalService
        return ApprovalService.can_user_action_step(request.user, obj.step, obj)

    def get_approval_history(self, obj):
        request = self.context.get('request')
        queryset = None
        if obj.claim:
            queryset = ApprovalInstance.objects.filter(claim=obj.claim)
        elif obj.ledger:
            queryset = ApprovalInstance.objects.filter(ledger=obj.ledger)
        elif obj.expense:
            queryset = ApprovalInstance.objects.filter(expense=obj.expense)

        if queryset:
            from .services import ApprovalService
            instances = queryset.prefetch_related('step__assigned_users').select_related(
                'step', 'step__assigned_role', 'action_by').order_by('step__step_order', 'created_at')
            return [
                {
                    'instance_id': inst.instance_id,
                    'step_id': inst.step_id if inst.step else None,
                    'step_order': inst.step.step_order if inst.step else 0,
                    'step_name': inst.step.step_name if inst.step else 'Step',
                    'assigned_role_name': inst.step.assigned_role.role_name if (inst.step and inst.step.assigned_role) else '',
                    'assigned_users_names': [u.full_name or u.username for u in inst.step.assigned_users.all()] if inst.step else [],
                    'assigned_users_ids': [u.pk for u in inst.step.assigned_users.all()] if inst.step else [],
                    'can_action': ApprovalService.can_user_action_step(request.user, inst.step, inst) if (request and request.user and request.user.is_authenticated and inst.status == 'Pending') else False,
                    'action_by_username': inst.action_by.username if inst.action_by else None,
                    'action_by_full_name': (inst.action_by.full_name or inst.action_by.username) if inst.action_by else None,
                    'status': inst.status,
                    'comments': inst.comments or '',
                    'actioned_at': inst.actioned_at.isoformat() if inst.actioned_at else None,
                    'created_at': inst.created_at.isoformat() if inst.created_at else None,
                }
                for inst in instances
            ]
        return []

    def get_workflow_steps(self, obj):
        if obj.step and obj.step.workflow:
            steps = obj.step.workflow.steps.prefetch_related('assigned_users').select_related('assigned_role').order_by('step_order')
            return [
                {
                    'step_id': s.step_id,
                    'step_order': s.step_order,
                    'step_name': s.step_name,
                    'assigned_role_name': s.assigned_role.role_name if s.assigned_role else '',
                    'assigned_users_ids': [u.pk for u in s.assigned_users.all()],
                    'assigned_users_names': [u.full_name or u.username for u in s.assigned_users.all()],
                    'is_final_step': s.is_final_step
                }
                for s in steps
            ]
        return []

    def get_target_summary(self, obj):
        if obj.claim:
            claim_expenses = obj.claim.expenses.select_related(
                'ticket', 'expense_type', 'responsible_store').prefetch_related('receipts').all()
            first_exp = claim_expenses.first()
            store_name = first_exp.responsible_store.store_name if first_exp and first_exp.responsible_store else (
                obj.claim.ticket.store.store_name if obj.claim.ticket and obj.claim.ticket.store else None)
            ticket_info = None
            if obj.claim.ticket:
                ticket_info = {
                    'ticket_id': obj.claim.ticket.ticket_id,
                    'work_order_no': obj.claim.ticket.work_order_no,
                    'title': obj.claim.ticket.title,
                }
            elif first_exp and first_exp.ticket:
                ticket_info = {
                    'ticket_id': first_exp.ticket.ticket_id,
                    'work_order_no': first_exp.ticket.work_order_no,
                    'title': first_exp.ticket.title,
                }

            from apps.common.serializers import MediaSerializer
            expenses_list = []
            tickets_list = []
            seen_tids = set()

            for exp in claim_expenses:
                t_info = None
                if exp.ticket:
                    t_info = {
                        'ticket_id': exp.ticket.ticket_id,
                        'work_order_no': exp.ticket.work_order_no,
                        'title': exp.ticket.title,
                    }
                    if exp.ticket.ticket_id not in seen_tids:
                        seen_tids.add(exp.ticket.ticket_id)
                        tickets_list.append(t_info)

                expenses_list.append({
                    'expense_id': exp.expense_id,
                    'amount': str(exp.amount),
                    'expense_date': str(exp.expense_date) if exp.expense_date else None,
                    'expense_type_name': exp.expense_type.expense_name if exp.expense_type else '',
                    'remarks': exp.remarks or '',
                    'store_name': exp.responsible_store.store_name if exp.responsible_store else (exp.ticket.store.store_name if exp.ticket and exp.ticket.store else None),
                    'ticket': t_info,
                    'receipts': MediaSerializer(exp.receipts.all(), many=True).data if hasattr(exp, 'receipts') else []
                })

            return {
                'type': 'Bundle',
                'id': obj.claim.claim_id,
                'label': f"Worker Claim Bundle {obj.claim.claim_id}",
                'worker': obj.claim.worker.full_name or obj.claim.worker.username if obj.claim.worker else 'N/A',
                'amount': str(obj.claim.total_claimed_amount),
                'store_name': store_name,
                'ticket': ticket_info,
                'tickets': tickets_list,
                'period_from': str(obj.claim.period_from) if obj.claim.period_from else None,
                'period_to': str(obj.claim.period_to) if obj.claim.period_to else None,
                'remarks': obj.claim.remarks or '',
                'expenses': expenses_list,
            }
        elif obj.ledger:
            from apps.common.serializers import MediaSerializer
            from apps.accounts.serializers import CustomUserSerializer

            tickets_list = []
            seen_tids = set()

            # Serialize bundles associated with this ledger
            bundles_list = []
            ledger_bundles = obj.ledger.bundles.select_related(
                'worker', 'ticket'
            ).prefetch_related(
                'expenses__receipts',
                'expenses__expense_type',
                'expenses__ticket',
                'expenses__responsible_store',
                'expenses__worker'
            ).all()

            for bundle in ledger_bundles:
                bundle_expenses = []
                for exp in bundle.expenses.all():
                    t_info = None
                    if exp.ticket:
                        t_info = {
                            'ticket_id': exp.ticket.ticket_id,
                            'work_order_no': exp.ticket.work_order_no,
                            'title': exp.ticket.title,
                        }
                        if exp.ticket.ticket_id not in seen_tids:
                            seen_tids.add(exp.ticket.ticket_id)
                            tickets_list.append(t_info)

                    bundle_expenses.append({
                        'expense_id': exp.expense_id,
                        'amount': str(exp.amount),
                        'expense_date': str(exp.expense_date) if exp.expense_date else None,
                        'expense_type_name': exp.expense_type.expense_name if exp.expense_type else '',
                        'expense_type_detail': {'expense_name': exp.expense_type.expense_name} if exp.expense_type else None,
                        'remarks': exp.remarks or '',
                        'worker': exp.worker.full_name or exp.worker.username if exp.worker else 'N/A',
                        'worker_detail': CustomUserSerializer(exp.worker).data if exp.worker else None,
                        'store_name': exp.responsible_store.store_name if exp.responsible_store else (exp.ticket.store.store_name if exp.ticket and exp.ticket.store else None),
                        'ticket': t_info,
                        'ticket_details': t_info,
                        'receipts': MediaSerializer(exp.receipts.all(), many=True).data if hasattr(exp, 'receipts') else []
                    })

                b_ticket = None
                if bundle.ticket:
                    b_ticket = {
                        'ticket_id': bundle.ticket.ticket_id,
                        'work_order_no': bundle.ticket.work_order_no,
                        'title': bundle.ticket.title,
                    }
                    if bundle.ticket.ticket_id not in seen_tids:
                        seen_tids.add(bundle.ticket.ticket_id)
                        tickets_list.append(b_ticket)

                bundles_list.append({
                    'claim_id': bundle.claim_id,
                    'worker': bundle.worker.full_name or bundle.worker.username if bundle.worker else 'N/A',
                    'worker_detail': CustomUserSerializer(bundle.worker).data if bundle.worker else None,
                    'total_claimed_amount': str(bundle.total_claimed_amount),
                    'status': bundle.status,
                    'period_from': str(bundle.period_from) if bundle.period_from else None,
                    'period_to': str(bundle.period_to) if bundle.period_to else None,
                    'remarks': bundle.remarks or '',
                    'ticket': b_ticket,
                    'ticket_details': b_ticket,
                    'expenses': bundle_expenses,
                })

            # Serialize direct ledger expenses (if any)
            ledger_expenses = obj.ledger.expenses.select_related(
                'ticket', 'expense_type', 'responsible_store', 'worker').prefetch_related('receipts').all()
            expenses_list = []
            for exp in ledger_expenses:
                t_info = None
                if exp.ticket:
                    t_info = {
                        'ticket_id': exp.ticket.ticket_id,
                        'work_order_no': exp.ticket.work_order_no,
                        'title': exp.ticket.title,
                    }
                    if exp.ticket.ticket_id not in seen_tids:
                        seen_tids.add(exp.ticket.ticket_id)
                        tickets_list.append(t_info)

                expenses_list.append({
                    'expense_id': exp.expense_id,
                    'amount': str(exp.amount),
                    'expense_date': str(exp.expense_date) if exp.expense_date else None,
                    'expense_type_name': exp.expense_type.expense_name if exp.expense_type else '',
                    'expense_type_detail': {'expense_name': exp.expense_type.expense_name} if exp.expense_type else None,
                    'remarks': exp.remarks or '',
                    'worker': exp.worker.full_name or exp.worker.username if exp.worker else 'N/A',
                    'worker_detail': CustomUserSerializer(exp.worker).data if exp.worker else None,
                    'store_name': exp.responsible_store.store_name if exp.responsible_store else (exp.ticket.store.store_name if exp.ticket and exp.ticket.store else None),
                    'ticket': t_info,
                    'ticket_details': t_info,
                    'receipts': MediaSerializer(exp.receipts.all(), many=True).data if hasattr(exp, 'receipts') else []
                })

            return {
                'type': 'Ledger',
                'id': obj.ledger.ledger_id,
                'label': f"Ledger Batch #{obj.ledger.ledger_id}",
                'amount': str(obj.ledger.total_amount),
                'store_name': obj.ledger.store.store_name if obj.ledger.store else 'General Location',
                'tickets': tickets_list,
                'remarks': obj.ledger.remarks or '',
                'bundles': bundles_list,
                'expenses': expenses_list,
            }
        elif obj.expense:
            exp = obj.expense
            st = exp.responsible_store or (
                exp.ticket.store if exp.ticket else None)
            ticket_info = None
            if exp.ticket:
                ticket_info = {
                    'ticket_id': exp.ticket.ticket_id,
                    'work_order_no': exp.ticket.work_order_no,
                    'title': exp.ticket.title,
                }

            receipts_data = []
            if hasattr(exp, 'receipts'):
                from apps.common.serializers import MediaSerializer
                receipts_data = MediaSerializer(
                    exp.receipts.all(), many=True).data

            ticket_attachments = []
            if exp.ticket and hasattr(exp.ticket, 'attachments'):
                from apps.common.serializers import MediaSerializer
                ticket_attachments = MediaSerializer(
                    exp.ticket.attachments.all(), many=True).data

            return {
                'type': 'Expense',
                'id': exp.expense_id,
                'label': f"Single Expense {exp.expense_id}",
                'worker': exp.worker.full_name or exp.worker.username if exp.worker else 'N/A',
                'amount': str(exp.amount),
                'store_name': st.store_name if st else 'General Location',
                'expense_date': str(exp.expense_date) if exp.expense_date else None,
                'expense_type_name': exp.expense_type.expense_name if exp.expense_type else '',
                'remarks': exp.remarks or '',
                'ticket': ticket_info,
                'receipts': receipts_data,
                'ticket_attachments': ticket_attachments,
            }
        return None


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source='actor.username', read_only=True)

    class Meta:
        model = AuditEvent
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    paid_by_username = serializers.CharField(
        source='paid_by.username', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
