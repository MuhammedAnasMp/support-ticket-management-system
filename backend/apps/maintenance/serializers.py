from rest_framework import serializers
from .models import Priority, Status, WorkNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory

class PrioritySerializer(serializers.ModelSerializer):
    class Meta:
        model = Priority
        fields = '__all__'

class StatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Status
        fields = '__all__'

class WorkNatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkNature
        fields = '__all__'

class NatureWorkerSerializer(serializers.ModelSerializer):
    class Meta:
        model = NatureWorker
        fields = '__all__'

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = '__all__'

class AllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allocation
        fields = '__all__'

class WorkLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLog
        fields = '__all__'

class TicketHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketHistory
        fields = '__all__'
