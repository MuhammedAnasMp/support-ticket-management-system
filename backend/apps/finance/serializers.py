from rest_framework import serializers
from .models import ExpenseType, EmployeeRate, Expense, Reconciliation, WorkerClaim
from apps.common.serializers import MediaSerializer
from apps.accounts.models import CustomUser


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

    class Meta:
        model = Expense
        fields = '__all__'
        depth = 1


class ExpenseWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

    def validate(self, data):
        ticket = data.get('ticket')
        expense_type = data.get('expense_type')
        if ticket and expense_type and expense_type.department != ticket.department:
            raise serializers.ValidationError(
                {"expense_type": f"Expense Type '{expense_type.expense_name}' does not belong to ticket department '{ticket.department.department_name}'."}
            )
        return data


class WorkerClaimSerializer(serializers.ModelSerializer):
    worker_detail = serializers.SerializerMethodField()
    approved_by_detail = serializers.SerializerMethodField()
    ticket_details = serializers.SerializerMethodField()
    expenses = serializers.SerializerMethodField()
    work_logs = serializers.SerializerMethodField()

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
        return None

    def get_expenses(self, obj):
        return ExpenseSerializer(obj.expenses.all(), many=True).data

    def get_work_logs(self, obj):
        from apps.maintenance.serializers import WorkLogSerializer
        return WorkLogSerializer(obj.work_logs.all(), many=True).data


class WorkerClaimWriteSerializer(serializers.ModelSerializer):
    expense_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True)
    worklog_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True)

    class Meta:
        model = WorkerClaim
        fields = '__all__'


class ReconciliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reconciliation
        fields = '__all__'
        depth = 1

