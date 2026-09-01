from rest_framework import viewsets, exceptions
from .models import Store, Department, SubDepartment, Area
from .serializers import StoreSerializer, DepartmentSerializer, SubDepartmentSerializer, AreaSerializer, SubDepartmentWriteSerializer

from django.db.models import Count


class AreaViewSet(viewsets.ModelViewSet):
    queryset = Area.objects.annotate(
        store_count=Count('stores')
    )
    serializer_class = AreaSerializer


class StoreViewSet(viewsets.ModelViewSet):
    serializer_class = StoreSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Store.objects.none()

        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '')
        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)]

        query_params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        all_param = str(query_params.get('all', '')).lower() in ('true', '1')

        is_admin_or_office = (
            user.is_superuser or
            any(r in role_name for r in ['office', 'admin', 'management']) or
            any('office' in g or 'admin' in g or 'management' in g for g in user_groups_lower) or
            user.has_perm('accounts.change_customuser') or
            user.has_perm('accounts.add_customuser') or
            user.has_perm('stores.add_store') or
            all_param
        )

        if is_admin_or_office:
            return Store.objects.all().select_related('area', 'manager').order_by('store_name')

        accessible_store_ids = list(
            user.accessible_stores.values_list('store_id', flat=True)
        )
        return Store.objects.filter(
            store_id__in=accessible_store_ids
        ).select_related('area', 'manager').distinct().order_by('store_name')


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class SubDepartmentViewSet(viewsets.ModelViewSet):
    queryset = SubDepartment.objects.all().select_related('department')
    serializer_class = SubDepartmentSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SubDepartmentWriteSerializer
        return SubDepartmentSerializer

    def get_queryset(self):
        return super().get_queryset()

    def perform_update(self, serializer):
        if serializer.instance.sub_department_name.lower().strip() == 'office':
            raise exceptions.ValidationError(
                {'detail': 'System sub-department "Office" cannot be modified or updated.'})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.sub_department_name.lower().strip() == 'office':
            raise exceptions.ValidationError(
                {'detail': 'System sub-department "Office" cannot be deleted.'})
        instance.delete()


class ManagerViewSet(viewsets.ModelViewSet):
    from .serializers import ManagerSerializer
    serializer_class = ManagerSerializer

    def get_queryset(self):
        from apps.accounts.models import CustomUser
        return CustomUser.objects.filter(
            role__role_name__icontains='Store Manager'
        ).select_related('role', 'managed_store').order_by('full_name')
