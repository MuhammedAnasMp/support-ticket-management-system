from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StoreViewSet, DepartmentViewSet, SubDepartmentViewSet

router = DefaultRouter()
router.register(r'store', StoreViewSet, basename='store')
router.register(r'department', DepartmentViewSet)
router.register(r'subdepartment', SubDepartmentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
