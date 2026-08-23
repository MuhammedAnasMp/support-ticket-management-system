from rest_framework import serializers
from .models import Store, Department, SubDepartment, Area


class AreaSerializer(serializers.ModelSerializer):
    store_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Area
        fields = '__all__'
        depth = 1


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = '__all__'

    def update(self, instance, validated_data):
        from django.utils import timezone
        instance.store_updated_at = timezone.now()
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['store_name'] = str(instance)
        
        # Nested serialization for area
        if instance.area:
            representation['area'] = {
                'area_id': instance.area.area_id,
                'area_name': instance.area.area_name
            }
        else:
            representation['area'] = None

        # Nested serialization for manager
        if instance.manager:
            representation['manager'] = {
                'user_id': instance.manager.user_id,
                'full_name': instance.manager.full_name,
                'username': instance.manager.username,
                'employee_no': instance.manager.employee_no,
                'phone': getattr(instance.manager, 'phone', None),
                'whatsapp_number': getattr(instance.manager, 'whatsapp_number', None)
            }
        else:
            representation['manager'] = None

        return representation


class ManagerSerializer(serializers.ModelSerializer):
    store = serializers.SerializerMethodField()
    store_id = serializers.CharField(write_only=True, required=False, allow_null=True)
    accessible_stores = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Store.objects.all(),
        required=False
    )
    username = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    employee_no = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        from apps.accounts.models import CustomUser
        model = CustomUser
        fields = [
            'user_id', 'employee_no', 'username', 'password', 'email', 'full_name', 'phone', 
            'whatsapp_number', 'role', 'store', 'store_id', 'accessible_stores', 'last_login'
        ]
        depth = 1

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        from apps.stores.serializers import StoreSerializer
        representation['accessible_stores'] = StoreSerializer(
            instance.accessible_stores.all(), many=True
        ).data
        return representation

    def get_store(self, obj):
        store = getattr(obj, 'managed_store', None)
        if store:
            return {
                'store_id': store.store_id,
                'store_name': store.store_name
            }
        return None

    def create(self, validated_data):
        from apps.accounts.models import CustomUser, Role
        store_id = validated_data.pop('store_id', None)
        password = validated_data.pop('password', None)
        accessible_stores = validated_data.pop('accessible_stores', None)
        
        try:
            role = Role.objects.get(role_name__icontains='Store Manager')
        except Role.DoesNotExist:
            try:
                role = Role.objects.get(pk=3)
            except Role.DoesNotExist:
                role = None

        email = validated_data.get('email')
        username = validated_data.get('username') or email

        user = CustomUser.objects.create(
            employee_no=validated_data.get('employee_no'),
            username=username,
            email=email,
            full_name=validated_data.get('full_name'),
            phone=validated_data.get('phone'),
            whatsapp_number=validated_data.get('whatsapp_number'),
            role=role,
            active=True
        )
        if password:
            user.set_password(password)
        else:
            user.set_password("123456")  # default password
        user.save()

        # Assign permission group
        from apps.accounts.serializers import assign_role_group
        assign_role_group(user)

        if store_id:
            try:
                store = Store.objects.get(pk=store_id)
                store.manager = user
                store.save()
            except Store.DoesNotExist:
                pass

        if accessible_stores is not None:
            user.accessible_stores.set(accessible_stores)

        return user

    def update(self, instance, validated_data):
        store_id = validated_data.pop('store_id', None)
        password = validated_data.pop('password', None)
        accessible_stores = validated_data.pop('accessible_stores', None)
        request = self.context.get('request')
        
        can_edit_full = True
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if not request.user.is_superuser and not request.user.has_perm('accounts.can_edit_full_manager_details'):
                can_edit_full = False

        instance.full_name = validated_data.get('full_name', instance.full_name)
        instance.email = validated_data.get('email', instance.email)
        instance.phone = validated_data.get('phone', instance.phone)
        instance.whatsapp_number = validated_data.get('whatsapp_number', instance.whatsapp_number)

        if can_edit_full:
            if 'employee_no' in validated_data:
                instance.employee_no = validated_data.get('employee_no')
            if 'username' in validated_data and validated_data.get('username'):
                instance.username = validated_data.get('username')
            if password:
                instance.set_password(password)

        instance.save()

        if store_id is not None:
            # Clear existing store relation
            Store.objects.filter(manager=instance).update(manager=None)
            if store_id:
                try:
                    store = Store.objects.get(pk=store_id)
                    Store.objects.filter(manager=store.manager).exclude(pk=store_id).update(manager=None)
                    store.manager = instance
                    store.save()
                except Store.DoesNotExist:
                    pass
        else:
            Store.objects.filter(manager=instance).update(manager=None)

        if accessible_stores is not None:
            instance.accessible_stores.set(accessible_stores)

        return instance


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'
        depth = 1


class SubDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubDepartment
        fields = '__all__'
        depth = 1


class SubDepartmentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubDepartment
        fields = '__all__'
