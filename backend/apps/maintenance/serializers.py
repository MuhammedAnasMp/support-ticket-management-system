from rest_framework import serializers
from .models import Priority, Status, WorkNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory
from apps.finance.models import EmployeeRate
from decimal import Decimal


class PrioritySerializer(serializers.ModelSerializer):
    class Meta:
        model = Priority
        fields = '__all__'
        depth = 1


class StatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Status
        fields = '__all__'
        depth = 1


class WorkNatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkNature
        fields = '__all__'
        depth = 1


class NatureWorkerSerializer(serializers.ModelSerializer):
    class Meta:
        model = NatureWorker
        fields = '__all__'
        depth = 1


class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = '__all__'
        depth = 1

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


class TicketWriteSerializer(serializers.ModelSerializer):
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
        depth = 1

class AllocationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allocation
        fields = '__all__'


class WorkLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLog
        fields = '__all__'
        depth = 1

class WorkLogWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLog
        fields = '__all__'
        # hourly_rate and labour_amount are auto-computed; mark them optional on input
        extra_kwargs = {
            'hourly_rate': {'required': False},
            'labour_amount': {'required': False},
        }

    def _get_rate(self, worker):
        """Return the most recent active EmployeeRate for the given worker, or None."""
        rate = (
            EmployeeRate.objects
            .filter(worker=worker)
            .order_by('-effective_from')
            .first()
        )
        return rate

    def validate(self, data):
        worker = data.get('worker') or getattr(self.instance, 'worker', None)
        hours = data.get('hours') or getattr(self.instance, 'hours', None)
        if worker and hours is not None:
            rate = self._get_rate(worker)
            if rate is None:
                raise serializers.ValidationError(
                    {"hourly_rate": f"No hourly rate found for worker '{worker.full_name}'. Please add a rate first."}
                )
            data['hourly_rate'] = rate.hourly_rate
            data['labour_amount'] = Decimal(str(hours)) * rate.hourly_rate
        return data


class TicketHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketHistory
        fields = '__all__'
        depth = 1
