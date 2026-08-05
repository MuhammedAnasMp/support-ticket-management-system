from rest_framework import viewsets
from .models import Store, Department, SubDepartment, Area
from .serializers import StoreSerializer, DepartmentSerializer, SubDepartmentSerializer, AreaSerializer


class AreaViewSet(viewsets.ModelViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer


class StoreViewSet(viewsets.ModelViewSet):
    serializer_class = StoreSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Store.objects.none()

        if user.is_superuser:
            return Store.objects.all().order_by('store_name')

        accessible_store_ids = list(
            user.accessible_stores.values_list('store_id', flat=True)
        )
        return Store.objects.filter(
            store_id__in=accessible_store_ids
        ).distinct().order_by('store_name')


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class SubDepartmentViewSet(viewsets.ModelViewSet):
    queryset = SubDepartment.objects.all()
    serializer_class = SubDepartmentSerializer
