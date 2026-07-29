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
        extra_kwargs = {
            'work_order_no': {'required': False},
            'created_by': {'required': False},
            'status': {'required': False},
            'priority': {'required': False},
        }

    def validate(self, data):
        department = data.get('department') or getattr(self.instance, 'department', None)
        nature = data.get('nature') or getattr(self.instance, 'nature', None)
        priority = data.get('priority') or getattr(self.instance, 'priority', None)
        status = data.get('status') or getattr(self.instance, 'status', None)
        created_by = data.get('created_by') or getattr(self.instance, 'created_by', None)

        if not created_by and 'request' in self.context and self.context['request'].user and not self.context['request'].user.is_anonymous:
            data['created_by'] = self.context['request'].user
            created_by = data['created_by']

        # Multi-tier fallback for priority
        if not priority:
            from .models import Priority
            p_obj = None
            if nature and nature.default_priority:
                p_obj = nature.default_priority
            if not p_obj and department:
                p_obj = Priority.objects.filter(department=department).order_by('level', 'priority_id').first()
            if not p_obj:
                p_obj = Priority.objects.filter(priority_name__iexact='Normal').first() or Priority.objects.first()
            if not p_obj and department:
                p_obj = Priority.objects.create(department=department, priority_name='Normal', level=1)
            
            if p_obj:
                data['priority'] = p_obj
                priority = p_obj

        # Multi-tier fallback for status
        if not status:
            from .models import Status
            s_obj = Status.objects.filter(status_name__iexact='Open').first() or Status.objects.order_by('status_id').first()
            if not s_obj:
                s_obj = Status.objects.create(status_name='Open')
            
            if s_obj:
                data['status'] = s_obj
                status = s_obj

        if not data.get('work_order_no'):
            import uuid, time
            data['work_order_no'] = f"WO-{int(time.time())}-{uuid.uuid4().hex[:4].upper()}"

        if priority and department and priority.department != department:
            from .models import Priority
            matching_p = Priority.objects.filter(department=department).first()
            if matching_p:
                data['priority'] = matching_p


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
            hourly_rate = rate.hourly_rate if rate else Decimal('0.00')
            data['hourly_rate'] = hourly_rate
            data['labour_amount'] = Decimal(str(hours)) * hourly_rate

        ticket = data.get('ticket') or getattr(self.instance, 'ticket', None)
        if not data.get('allocation') and worker and ticket:
            from .models import Allocation
            alloc = Allocation.objects.filter(ticket=ticket, worker=worker).first()
            if alloc:
                data['allocation'] = alloc
        return data


class TicketHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketHistory
        fields = '__all__'
        depth = 1
