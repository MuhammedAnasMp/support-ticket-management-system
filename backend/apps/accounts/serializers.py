from rest_framework import serializers
from .models import Role, CustomUser

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

class CustomUserSerializer(serializers.ModelSerializer):
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, write_only=True, allow_null=True)
    skills = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    effective_from = serializers.DateField(required=False, write_only=True, allow_null=True)
    effective_to = serializers.DateField(required=False, write_only=True, allow_null=True)

    class Meta:
        model = CustomUser
        extra_kwargs = {'password': {'write_only': True}}
        fields = [
            'user_id', 'username', 'email', 'first_name', 'last_name',
            'employee_no', 'full_name', 'phone', 'whatsapp_number', 'profile_image',
            'role', 'accessible_stores', 'sub_departments', 'active', 'password',
            'hourly_rate', 'skills', 'effective_from', 'effective_to'
        ]

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
            req_dept_ids = set(sd.department_id for sd in req_user.sub_departments.all())
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
                    NatureWorker.objects.get_or_create(worker=user, nature=nature)
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
            req_dept_ids = set(sd.department_id for sd in req_user.sub_departments.all())
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
            
        # Manage employee rate update
        if hourly_rate not in [None, '']:
            from apps.finance.models import EmployeeRate
            from django.utils import timezone
            from decimal import Decimal
            # Check current active rate
            latest_rate = instance.rates.order_by('-effective_from', '-rate_id').first()
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
                    NatureWorker.objects.get_or_create(worker=instance, nature=nature)
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
        representation['role'] = RoleSerializer(instance.role).data if instance.role else None
        representation['accessible_stores'] = StoreSerializer(instance.accessible_stores.all(), many=True).data
        representation['sub_departments'] = SubDepartmentSerializer(instance.sub_departments.all(), many=True).data
        
        # Add current hourly rate
        latest_rate = instance.rates.order_by('-effective_from', '-rate_id').first()
        representation['hourly_rate'] = str(latest_rate.hourly_rate) if latest_rate else None
        
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
        
        return representation

