from rest_framework import serializers
from .models import Role, CustomUser


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['role_id', 'role_name', 'permissions']

    def get_permissions(self, obj):
        from django.contrib.auth.models import Group
        try:
            group = Group.objects.get(name=obj.role_name)
            return list(group.permissions.values_list('codename', flat=True))
        except Group.DoesNotExist:
            return []


def assign_role_group(user):
    if user.role:
        from django.contrib.auth.models import Group
        group_name = user.role.role_name
        group, created = Group.objects.get_or_create(name=group_name)
        user.groups.set([group])


class CustomUserSerializer(serializers.ModelSerializer):
    hourly_rate = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, write_only=True, allow_null=True)
    skills = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True)
    effective_from = serializers.DateField(
        required=False, write_only=True, allow_null=True)
    effective_to = serializers.DateField(
        required=False, write_only=True, allow_null=True)

    class Meta:
        model = CustomUser
        extra_kwargs = {'password': {'write_only': True}}
        fields = [
            'user_id', 'username', 'email', 'first_name', 'last_name',
            'employee_no', 'full_name', 'phone', 'whatsapp_number', 'profile_image',
            'role', 'accessible_stores', 'sub_departments', 'active', 'password',
            'hourly_rate', 'skills', 'effective_from', 'effective_to'
        ]

    def validate(self, attrs):
        active = attrs.get(
            'active', self.instance.active if self.instance else True)
        if active:
            # 1. Role is required
            role = attrs.get(
                'role', self.instance.role if self.instance else None)
            if not role:
                raise serializers.ValidationError(
                    {"role": "Role is required to approve this employee."}
                )

            # 2. Accessible store is required
            stores = attrs.get('accessible_stores', [])
            if self.instance and 'accessible_stores' not in attrs:
                stores = list(self.instance.accessible_stores.all())
            if not stores:
                raise serializers.ValidationError(
                    {"accessible_stores": "To approve this employee, you must assign at least one store allocation."}
                )

            # 3. Check if Office vs Technical employee
            sub_depts = attrs.get('sub_departments', [])
            if self.instance and 'sub_departments' not in attrs:
                sub_depts = list(self.instance.sub_departments.all())

            sd_names = [sd.sub_department_name.strip().lower()
                        for sd in sub_depts]
            has_technical_dept = any(name != 'office' for name in sd_names)

            # Check if role has technician permissions
            from django.contrib.auth.models import Group
            group_perms = []
            if role:
                try:
                    group = Group.objects.get(name=role.role_name)
                    group_perms = list(
                        group.permissions.values_list('codename', flat=True))
                except Group.DoesNotExist:
                    pass
            is_tech_role = 'complete_ticket' in group_perms or 'technician' in (
                role.role_name or '').lower()

            is_office_admin = role and ('office admin' in role.role_name.lower(
            ) or 'office administrator' in role.role_name.lower())

            acts_as_tech = is_tech_role or has_technical_dept

            if acts_as_tech and not is_office_admin:
                # Skills required
                skills = attrs.get('skills', None)
                if skills is None and self.instance:
                    skills = list(self.instance.skilled_natures.all())
                if not skills:
                    raise serializers.ValidationError(
                        {"skills": "To approve this employee, you must assign at least one technical skill."}
                    )

                # Hourly rate required
                hourly_rate = attrs.get('hourly_rate', None)
                if hourly_rate is None and self.instance:
                    latest_rate = self.instance.rates.order_by(
                        '-effective_from', '-rate_id').first()
                    hourly_rate = latest_rate.hourly_rate if latest_rate else None
                if 'office' not in sd_names and hourly_rate in [None, '']:
                    raise serializers.ValidationError(
                        {"hourly_rate": "Hourly wage rate is required to approve this employee."}
                    )

        return attrs

    def create(self, validated_data):
        hourly_rate = validated_data.pop('hourly_rate', None)
        skills = validated_data.pop('skills', None)
        password = validated_data.pop('password', None)
        effective_from = validated_data.pop('effective_from', None)
        effective_to = validated_data.pop('effective_to', None)

        # Enforce department restriction for non-superusers
        request = self.context.get('request')
        if request and request.user and not request.user.is_superuser:
            from apps.maintenance.models import WorkNature
            req_user = request.user
            req_dept_ids = set(
                sd.department_id for sd in req_user.sub_departments.all())
            if req_dept_ids:
                if 'sub_departments' in validated_data:
                    validated_data['sub_departments'] = [
                        sd for sd in validated_data['sub_departments']
                        if sd.department_id in req_dept_ids
                    ]
                if skills:
                    skills = [
                        sid for sid in skills
                        if WorkNature.objects.filter(pk=sid, sub_department__department_id__in=req_dept_ids).exists()
                    ]

        # Ensure username defaults to employee_no if not present
        if 'username' not in validated_data and 'employee_no' in validated_data:
            validated_data['username'] = validated_data['employee_no']

        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()

        # Assign role-based permission group
        assign_role_group(user)

        # Create EmployeeRate if hourly_rate is provided
        if hourly_rate not in [None, '']:
            from apps.finance.models import EmployeeRate
            from django.utils import timezone
            eff_from = effective_from or timezone.now().date()
            EmployeeRate.objects.create(
                worker=user,
                hourly_rate=hourly_rate,
                effective_from=eff_from,
                effective_to=effective_to
            )

        # Associate multiple worker skills (NatureWorker)
        if skills:
            from apps.maintenance.models import NatureWorker, WorkNature
            for skill_id in skills:
                try:
                    nature = WorkNature.objects.get(pk=skill_id)
                    NatureWorker.objects.get_or_create(
                        worker=user, nature=nature)
                except WorkNature.DoesNotExist:
                    pass

        return user

    def update(self, instance, validated_data):
        hourly_rate = validated_data.pop('hourly_rate', None)
        skills = validated_data.pop('skills', None)
        password = validated_data.pop('password', None)
        effective_from = validated_data.pop('effective_from', None)
        effective_to = validated_data.pop('effective_to', None)

        # Enforce department restriction for non-superusers
        request = self.context.get('request')
        if request and request.user and not request.user.is_superuser:
            from apps.maintenance.models import WorkNature
            req_user = request.user
            req_dept_ids = set(
                sd.department_id for sd in req_user.sub_departments.all())
            if req_dept_ids:
                if 'sub_departments' in validated_data:
                    validated_data['sub_departments'] = [
                        sd for sd in validated_data['sub_departments']
                        if sd.department_id in req_dept_ids
                    ]
                if skills:
                    skills = [
                        sid for sid in skills
                        if WorkNature.objects.filter(pk=sid, sub_department__department_id__in=req_dept_ids).exists()
                    ]

        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()

        # Assign role-based permission group
        assign_role_group(user)

        # Manage employee rate update
        if hourly_rate not in [None, '']:
            from apps.finance.models import EmployeeRate
            from django.utils import timezone
            from decimal import Decimal
            # Check current active rate
            latest_rate = instance.rates.order_by(
                '-effective_from', '-rate_id').first()
            if not latest_rate or latest_rate.hourly_rate != Decimal(str(hourly_rate)):
                eff_from = effective_from or timezone.now().date()
                EmployeeRate.objects.create(
                    worker=instance,
                    hourly_rate=Decimal(str(hourly_rate)),
                    effective_from=eff_from,
                    effective_to=effective_to
                )

        # Manage worker skills update
        if skills is not None:
            from apps.maintenance.models import NatureWorker, WorkNature
            # Exclude/delete removed skills
            instance.skilled_natures.exclude(nature_id__in=skills).delete()
            # Add new skills
            for skill_id in skills:
                try:
                    nature = WorkNature.objects.get(pk=skill_id)
                    NatureWorker.objects.get_or_create(
                        worker=instance, nature=nature)
                except WorkNature.DoesNotExist:
                    pass

        return user

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Import serializers locally to avoid circular dependencies
        from apps.accounts.serializers import RoleSerializer
        from apps.stores.serializers import StoreSerializer, SubDepartmentSerializer
        from apps.maintenance.serializers import WorkNatureSerializer

        # Populate nested objects for reads
        representation['role'] = RoleSerializer(
            instance.role).data if instance.role else None
        representation['accessible_stores'] = StoreSerializer(
            instance.accessible_stores.all(), many=True).data
        representation['sub_departments'] = SubDepartmentSerializer(
            instance.sub_departments.all(), many=True).data

        # Add current hourly rate
        latest_rate = instance.rates.order_by(
            '-effective_from', '-rate_id').first()
        representation['hourly_rate'] = str(
            latest_rate.hourly_rate) if latest_rate else None

        # Add rates history
        representation['rates'] = [
            {
                "rate_id": r.rate_id,
                "hourly_rate": str(r.hourly_rate),
                "effective_from": str(r.effective_from),
                "effective_to": str(r.effective_to) if r.effective_to else None
            }
            for r in instance.rates.all().order_by('-effective_from', '-rate_id')
        ]

        # Add skills
        representation['skills'] = WorkNatureSerializer(
            [sn.nature for sn in instance.skilled_natures.all()],
            many=True
        ).data

        # Add managed store details if exists
        managed_store = getattr(instance, 'managed_store', None)
        if managed_store:
            representation['managed_store'] = {
                'store_id': managed_store.store_id,
                'store_name': managed_store.store_name,
                'type': managed_store.type,
                'area_name': managed_store.area.area_name if managed_store.area else None,
                'address': managed_store.address,
                'phone': managed_store.phone,
                'whatsapp_number': managed_store.whatsapp_number,
                'longitude': str(managed_store.longitude) if managed_store.longitude is not None else None,
                'latitude': str(managed_store.latitude) if managed_store.latitude is not None else None,
            }
        else:
            representation['managed_store'] = None

        return representation
