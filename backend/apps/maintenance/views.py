from rest_framework import viewsets
from .models import Priority, Status, WorkNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory
from .serializers import (
    PrioritySerializer, StatusSerializer, WorkNatureSerializer,
    NatureWorkerSerializer, TicketSerializer, AllocationSerializer,
    WorkLogSerializer, TicketHistorySerializer
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

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

class AllocationViewSet(viewsets.ModelViewSet):
    queryset = Allocation.objects.all()
    serializer_class = AllocationSerializer

class WorkLogViewSet(viewsets.ModelViewSet):
    queryset = WorkLog.objects.all()
    serializer_class = WorkLogSerializer

class TicketHistoryViewSet(viewsets.ModelViewSet):
    queryset = TicketHistory.objects.all()
    serializer_class = TicketHistorySerializer
