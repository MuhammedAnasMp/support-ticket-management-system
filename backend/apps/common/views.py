from rest_framework import viewsets
from .models import MediaCategory, Media, Notification
from .serializers import MediaCategorySerializer, MediaSerializer, NotificationSerializer, MediaWriteSerializer
from apps.stores.models import SubDepartment
from rest_framework.exceptions import ValidationError


class MediaCategoryViewSet(viewsets.ModelViewSet):
    queryset = MediaCategory.objects.all()
    serializer_class = MediaCategorySerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        sub_department_id = self.request.query_params.get("department")

        if sub_department_id:
            try:
                sub_department = SubDepartment.objects.select_related("department").get(
                    pk=sub_department_id
                )
                queryset = queryset.filter(
                    department=sub_department.department)
            except SubDepartment.DoesNotExist:
                raise ValidationError(
                    {"department": "Invalid sub-department ID."}
                )

        return queryset


class MediaViewSet(viewsets.ModelViewSet):
    queryset = Media.objects.all()
    serializer_class = MediaSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MediaWriteSerializer
        return MediaSerializer

    def get_queryset(self):
        queryset = self.queryset

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
