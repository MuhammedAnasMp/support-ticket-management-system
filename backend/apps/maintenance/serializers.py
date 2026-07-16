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

    def validate(self, data):
        department = data.get('department')
        priority = data.get('priority')
        status = data.get('status')
        nature = data.get('nature')

        if priority and department and priority.department != department:
            raise serializers.ValidationError(
                {"priority": f"Priority '{priority.priority_name}' does not belong to department '{department.department_name}'."}
            )
        if status and department and status.department != department:
            raise serializers.ValidationError(
                {"status": f"Status '{status.status_name}' does not belong to department '{department.department_name}'."}
            )
        if nature and department and nature.sub_department.department != department:
            raise serializers.ValidationError(
                {"nature": f"Work Nature '{nature.nature_name}' belongs to a different department than '{department.department_name}'."}
            )
        return data

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
