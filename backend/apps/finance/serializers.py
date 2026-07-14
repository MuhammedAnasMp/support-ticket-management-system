from rest_framework import serializers
from .models import ExpenseType, EmployeeRate, Expense, Reconciliation

class ExpenseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseType
        fields = '__all__'

class EmployeeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeRate
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

class ReconciliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reconciliation
        fields = '__all__'
