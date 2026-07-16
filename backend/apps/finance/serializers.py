from rest_framework import serializers
from .models import ExpenseType, EmployeeRate, Expense, Reconciliation

class ExpenseTypeSerializer(serializers.ModelSerializer):
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
    class Meta:
        model = EmployeeRate
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
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

class ReconciliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reconciliation
        fields = '__all__'
