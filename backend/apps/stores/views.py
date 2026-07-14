from rest_framework import viewsets
from .models import Store, Department, SubDepartment
from .serializers import StoreSerializer, DepartmentSerializer, SubDepartmentSerializer

class StoreViewSet(viewsets.ModelViewSet):
    serializer_class = StoreSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Store.objects.none()
        
        # Office or Superuser has access to all stores
        if user.is_superuser or (user.role and user.role.role_name.lower() == 'office'):
            return Store.objects.all()
        
        # Managers and Employees see only stores they have access to
        home_store_id = user.store_id
        accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
        if home_store_id:
            accessible_store_ids.append(home_store_id)
            
        return Store.objects.filter(store_id__in=accessible_store_ids).distinct()

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

class SubDepartmentViewSet(viewsets.ModelViewSet):
    queryset = SubDepartment.objects.all()
    serializer_class = SubDepartmentSerializer
