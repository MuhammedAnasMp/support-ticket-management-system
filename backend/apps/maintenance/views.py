from rest_framework import viewsets
from .models import Priority, Status, WorkNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory
from .serializers import (
    PrioritySerializer, StatusSerializer, WorkNatureSerializer,
    NatureWorkerSerializer, TicketSerializer, AllocationSerializer,
    WorkLogSerializer, TicketHistorySerializer,
    AllocationWriteSerializer, WorkLogWriteSerializer, TicketWriteSerializer
)


class PriorityViewSet(viewsets.ModelViewSet):
    queryset = Priority.objects.all()
    serializer_class = PrioritySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)
        return queryset


class StatusViewSet(viewsets.ModelViewSet):
    queryset = Status.objects.all()
    serializer_class = StatusSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)
        return queryset


class WorkNatureViewSet(viewsets.ModelViewSet):
    queryset = WorkNature.objects.all()
    serializer_class = WorkNatureSerializer


class NatureWorkerViewSet(viewsets.ModelViewSet):
    queryset = NatureWorker.objects.all()
    serializer_class = NatureWorkerSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        nature = self.request.query_params.get('nature')
        if nature:
            queryset = queryset.filter(nature_id=nature)
        return queryset


class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TicketWriteSerializer
        return TicketSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return Ticket.objects.none()
        
        if user.is_superuser:
            return queryset
            
        home_store_id = user.store_id
        accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
        if home_store_id:
            accessible_store_ids.append(home_store_id)
            
        return queryset.filter(store_id__in=accessible_store_ids).distinct()


class AllocationViewSet(viewsets.ModelViewSet):
    queryset = Allocation.objects.all()
    serializer_class = AllocationSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AllocationWriteSerializer
        return AllocationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return Allocation.objects.none()
        
        if not user.is_superuser:
            home_store_id = user.store_id
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if home_store_id:
                accessible_store_ids.append(home_store_id)
            queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset


class WorkLogViewSet(viewsets.ModelViewSet):
    queryset = WorkLog.objects.all()
    serializer_class = WorkLogSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WorkLogWriteSerializer
        return WorkLogSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return WorkLog.objects.none()
            
        if not user.is_superuser:
            home_store_id = user.store_id
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if home_store_id:
                accessible_store_ids.append(home_store_id)
            queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset


class TicketHistoryViewSet(viewsets.ModelViewSet):
    queryset = TicketHistory.objects.all()
    serializer_class = TicketHistorySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user or user.is_anonymous:
            return TicketHistory.objects.none()
            
        if not user.is_superuser:
            home_store_id = user.store_id
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if home_store_id:
                accessible_store_ids.append(home_store_id)
            queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset
