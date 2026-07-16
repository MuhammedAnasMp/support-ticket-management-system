from rest_framework import viewsets
from .models import ExpenseType, EmployeeRate, Expense, Reconciliation
from .serializers import ExpenseTypeSerializer, EmployeeRateSerializer, ExpenseSerializer, ReconciliationSerializer

class ExpenseTypeViewSet(viewsets.ModelViewSet):
    queryset = ExpenseType.objects.all()
    serializer_class = ExpenseTypeSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)
        return queryset

class EmployeeRateViewSet(viewsets.ModelViewSet):
    queryset = EmployeeRate.objects.all()
    serializer_class = EmployeeRateSerializer

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer

class ReconciliationViewSet(viewsets.ModelViewSet):
    queryset = Reconciliation.objects.all()
    serializer_class = ReconciliationSerializer
