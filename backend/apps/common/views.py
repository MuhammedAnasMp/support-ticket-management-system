from rest_framework import viewsets
from .models import MediaCategory, Media, Notification
from .serializers import MediaCategorySerializer, MediaSerializer, NotificationSerializer

class MediaCategoryViewSet(viewsets.ModelViewSet):
    queryset = MediaCategory.objects.all()
    serializer_class = MediaCategorySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)
        return queryset

class MediaViewSet(viewsets.ModelViewSet):
    queryset = Media.objects.all()
    serializer_class = MediaSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
