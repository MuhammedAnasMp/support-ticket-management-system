from django.db.models import Q
from rest_framework import viewsets, exceptions
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination
from .models import Priority, Status, WorkNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory
from .serializers import (
    PrioritySerializer, StatusSerializer, WorkNatureSerializer,
    NatureWorkerSerializer, TicketSerializer, AllocationSerializer,
    WorkLogSerializer, TicketHistorySerializer,
    AllocationWriteSerializer, WorkLogWriteSerializer, TicketWriteSerializer
)


class TicketPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


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

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(
                sub_department__department_id=department)
        return queryset


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
    queryset = Ticket.objects.all().order_by(
        '-created_date').prefetch_related('allocations', 'allocations__worker')
    serializer_class = TicketSerializer
    pagination_class = TicketPagination

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
            pass
        else:
            # Filter by ticket status permissions.
            disallowed_status_ids = []
            for s in Status.objects.all():
                codename = 'can_view_{}_ticket'.format(
                    s.status_name.lower().replace(' ', '_')
                )
                perm = 'maintenance.{}'.format(codename)
                if not user.has_perm(perm):
                    disallowed_status_ids.append(s.status_id)

            if disallowed_status_ids:
                queryset = queryset.exclude(
                    status_id__in=disallowed_status_ids)

            # Technicians only see tickets allocated to them
            role_name = (user.role.role_name.lower() if hasattr(
                user, 'role') and user.role else '')
            if role_name == 'technician':
                queryset = queryset.filter(allocations__worker=user).distinct()
            else:
                # Filter non-superusers by accessible stores
                accessible_store_ids = list(
                    user.accessible_stores.values_list('store_id', flat=True))
                if accessible_store_ids:
                    queryset = queryset.filter(
                        store_id__in=accessible_store_ids).distinct()
                else:
                    return Ticket.objects.none()

                # Check department level restriction
                user_groups_lower = [
                    g.lower().strip() for g in user.groups.values_list('name', flat=True)]
                can_view_all_depts = (
                    user.has_perm('maintenance.view_all_department_tickets') or
                    user.has_perm('maintenance.create_ticket_all_departments') or
                    'main_admin' in user_groups_lower or
                    'main administrator' in user_groups_lower
                )

                if not can_view_all_depts:
                    user_dept_ids = list(user.sub_departments.values_list(
                        'department_id', flat=True))
                    if user_dept_ids:
                        queryset = queryset.filter(
                            department_id__in=user_dept_ids)
                    else:
                        return Ticket.objects.none()

        # Query parameter filters
        params = self.request.query_params
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(work_order_no__icontains=search)
            )

        store = params.get('store')
        if store:
            queryset = queryset.filter(store_id=store)

        department = params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)

        status = params.get('status')
        if status:
            queryset = queryset.filter(status__status_name=status)

        from_date = params.get('from_date')
        if from_date:
            queryset = queryset.filter(created_date__gte=from_date)

        to_date = params.get('to_date')
        if to_date:
            if len(to_date) == 10:
                to_date = f"{to_date} 23:59:59"
            queryset = queryset.filter(created_date__lte=to_date)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {}
        if user and not user.is_anonymous:
            kwargs['created_by'] = user
        serializer.save(**kwargs)

    # def _run_status_rules(self, ticket, from_status, to_status):
    #     """
    #     Runs StatusRequiredField validation and StatusClearField clearing for a
    #     status transition.  Returns a list of cleared-field messages.
    #     Raises ValidationError if any required-field rule fails.
    #     """
    #     from rest_framework.exceptions import ValidationError as DRFValidationError
    #     from .utils import validate_ticket_required_fields, clear_ticket_fields

    #     errors = validate_ticket_required_fields(ticket, from_status, to_status)
    #     if errors:
    #         raise DRFValidationError({"status_validation": errors})

    #     cleared = clear_ticket_fields(ticket, from_status, to_status)
    #     return cleared


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
            accessible_store_ids = list(
                user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(
                    ticket__store_id__in=accessible_store_ids)

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
            accessible_store_ids = list(
                user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(
                    ticket__store_id__in=accessible_store_ids)

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
            accessible_store_ids = list(
                user.accessible_stores.values_list('store_id', flat=True))
            if accessible_store_ids:
                queryset = queryset.filter(
                    ticket__store_id__in=accessible_store_ids)

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset
