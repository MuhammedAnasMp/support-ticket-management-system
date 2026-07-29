from rest_framework import viewsets
from .models import ExpenseType, EmployeeRate, Expense, Reconciliation
from .serializers import (
    ExpenseTypeSerializer, EmployeeRateSerializer, ExpenseSerializer,
    ReconciliationSerializer, ExpenseWriteSerializer, ExpenseTypeWriteSerializer
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
        
        if not user.is_superuser:
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset


class ReconciliationViewSet(viewsets.ModelViewSet):
    queryset = Reconciliation.objects.all()
    serializer_class = ReconciliationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return Reconciliation.objects.none()
            
        if not user.is_superuser:
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        return queryset
