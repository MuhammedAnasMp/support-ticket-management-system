from django.utils import timezone
from rest_framework import viewsets, exceptions
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

        # Technicians only see tickets allocated to them
        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '')
        if role_name == 'technician':
            return queryset.filter(allocations__worker=user).distinct()

        # Filter non-superusers by accessible stores
        accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
        if accessible_store_ids:
            queryset = queryset.filter(store_id__in=accessible_store_ids).distinct()
        else:
            return Ticket.objects.none()

        # Check department level restriction
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)]
        can_view_all_depts = (
            user.has_perm('maintenance.view_all_department_tickets') or
            user.has_perm('maintenance.create_ticket_all_departments') or
            'main_admin' in user_groups_lower or
            'main administrator' in user_groups_lower
        )

        if not can_view_all_depts:
            user_dept_ids = list(user.sub_departments.values_list('department_id', flat=True))
            if user_dept_ids:
                queryset = queryset.filter(department_id__in=user_dept_ids)
            else:
                return Ticket.objects.none()

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {}
        if user and not user.is_anonymous:
            kwargs['created_by'] = user
        serializer.save(**kwargs)

    def perform_update(self, serializer):
        user = self.request.user
        status = serializer.validated_data.get('status')
        if status:
            status_name = status.status_name.lower()
            if status_name in ['approved', 'rejected']:
                can_approve_reject = (
                    user.is_superuser or
                    user.has_perm('maintenance.approve_ticket') or
                    user.has_perm('maintenance.reject_ticket')
                )
                if not can_approve_reject:
                    raise exceptions.PermissionDenied("You do not have permission to approve or reject tickets.")

                if status_name == 'approved':
                    serializer.save(approved_by=user, approved_date=timezone.now())
                    return
                elif status_name == 'rejected':
                    serializer.save(rejected_by=user, rejected_date=timezone.now())
                    return
            elif status_name == 'completed':
                can_complete = (
                    user.is_superuser or
                    user.has_perm('maintenance.complete_ticket')
                )
                if not can_complete:
                    raise exceptions.PermissionDenied("You do not have permission to mark tickets as completed.")
                serializer.save(closed_by=user, closed_date=timezone.now())
                return

        serializer.save()


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
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {}
        if user and not user.is_anonymous:
            kwargs['assigned_by'] = user
        allocation = serializer.save(**kwargs)
        if allocation.worker and allocation.ticket and allocation.ticket.store:
            allocation.worker.accessible_stores.add(allocation.ticket.store)

    def perform_update(self, serializer):
        allocation = serializer.save()
        if allocation.worker and allocation.ticket and allocation.ticket.store:
            allocation.worker.accessible_stores.add(allocation.ticket.store)


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
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
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
            accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset
