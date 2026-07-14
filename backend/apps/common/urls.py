from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MediaCategoryViewSet, MediaViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r'mediacategory', MediaCategoryViewSet)
router.register(r'media', MediaViewSet)
router.register(r'notification', NotificationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
