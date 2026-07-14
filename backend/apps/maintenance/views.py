from rest_framework import viewsets
from .models import Priority, Status, MaintenanceNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory
from .serializers import (
    PrioritySerializer, StatusSerializer, MaintenanceNatureSerializer,
    NatureWorkerSerializer, TicketSerializer, AllocationSerializer,
    WorkLogSerializer, TicketHistorySerializer
)

class PriorityViewSet(viewsets.ModelViewSet):
    queryset = Priority.objects.all()
    serializer_class = PrioritySerializer

class StatusViewSet(viewsets.ModelViewSet):
    queryset = Status.objects.all()
    serializer_class = StatusSerializer

class MaintenanceNatureViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceNature.objects.all()
    serializer_class = MaintenanceNatureSerializer

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
