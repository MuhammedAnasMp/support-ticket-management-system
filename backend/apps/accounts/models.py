from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db.models.signals import m2m_changed
from django.dispatch import receiver
from django.conf import settings
import os
import re

phone_validator = RegexValidator(
    regex=r'^\d{8}$',
    message='Phone number must be exactly 8 digits.'
)

whatsapp_validator = RegexValidator(
    regex=r'^\d{8}$|^\d{10}$',
    message='WhatsApp number must be either 8 or 10 digits.'
)


def get_profile_image_path(instance, filename):
    dept_name = 'unassigned'
    subdept_name = 'unassigned'

    if instance.pk:
        # User exists, try to get the first subdepartment
        sub_dept = instance.sub_departments.first()
        if sub_dept:
            subdept_name = sub_dept.sub_department_name
            if sub_dept.department:
                dept_name = sub_dept.department.department_name

    def clean(s):
        cleaned = re.sub(r'[^a-zA-Z0-9_\-]', '_', s.lower())
        return cleaned.strip('_')

    dept_clean = clean(dept_name) or 'unassigned'
    subdept_clean = clean(subdept_name) or 'unassigned'
    username_clean = clean(instance.username or 'user')

    return f"profileimagse/{dept_clean}/{subdept_clean}/{username_clean}.png"


def move_profile_image_to_correct_path(instance):
    if not instance.profile_image:
        return

    old_name = instance.profile_image.name
    new_name = get_profile_image_path(instance, "")

    if old_name != new_name:
        old_full_path = os.path.join(settings.MEDIA_ROOT, old_name)
        new_full_path = os.path.join(settings.MEDIA_ROOT, new_name)

        if os.path.exists(old_full_path):
            os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
            try:
                if os.path.exists(new_full_path) and old_full_path != new_full_path:
                    os.remove(new_full_path)
                os.rename(old_full_path, new_full_path)
                instance.profile_image.name = new_name
                instance.save(update_fields=['profile_image'])
            except Exception:
                pass


class Role(models.Model):
    role_id = models.AutoField(primary_key=True)
    role_name = models.CharField(max_length=100, unique=True)

    class Meta:
        permissions = [
            ("view_role_name", "Can view role name"),
            ("change_role_name", "Can change role name"),
        ]

    def __str__(self):
        return self.role_name


class CustomUser(AbstractUser):
    # Overriding the default id PK
    user_id = models.AutoField(primary_key=True)
    employee_no = models.CharField(
        max_length=50, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, null=True,
                             blank=True, validators=[phone_validator])
    whatsapp_number = models.CharField(
        max_length=50, null=True, blank=True, validators=[whatsapp_validator])
    profile_image = models.ImageField(
        upload_to=get_profile_image_path, null=True, blank=True)
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    store = models.ForeignKey(
        'stores.Store', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    accessible_stores = models.ManyToManyField(
        'stores.Store', blank=True, related_name='accessible_users')
    sub_departments = models.ManyToManyField(
        'stores.SubDepartment', blank=True, related_name='users')
    active = models.BooleanField(default=False)

    class Meta:
        permissions = [
            ("view_employee_no", "Can view employee no"),
            ("change_employee_no", "Can change employee no"),
            ("view_full_name", "Can view full name"),
            ("change_full_name", "Can change full name"),
            ("view_phone", "Can view phone"),
            ("change_phone", "Can change phone"),
            ("view_whatsapp_number", "Can view whatsapp number"),
            ("change_whatsapp_number", "Can change whatsapp number"),
            ("view_profile_image", "Can view profile image"),
            ("change_profile_image", "Can change profile image"),
            ("view_role", "Can view role"),
            ("change_role", "Can change role"),
            ("view_store", "Can view store"),
            ("change_store", "Can change store"),
            ("view_accessible_stores", "Can view accessible stores"),
            ("change_accessible_stores", "Can change accessible stores"),
            ("view_sub_departments", "Can view sub departments"),
            ("change_sub_departments", "Can change sub departments"),
            ("view_active", "Can view active"),
            ("change_active", "Can change active"),
        ]

    def __str__(self):
        return self.full_name if self.full_name else self.username


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name='password_reset_otps')
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.otp}"

    def is_valid(self):
        from django.utils import timezone
        import datetime
        return not self.is_used and (timezone.now() - self.created_at) < datetime.timedelta(minutes=10)


class WhatsAppLog(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL,
                             null=True, blank=True, related_name='whatsapp_logs')
    whatsapp_number = models.CharField(max_length=50)
    message_type = models.CharField(max_length=50, default='OTP')
    otp = models.CharField(max_length=6, null=True, blank=True)
    payload = models.TextField(null=True, blank=True)
    response = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=50)  # 'success' or 'failed'
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.whatsapp_number} - {self.status} - {self.created_at}"


@receiver(m2m_changed, sender=CustomUser.sub_departments.through)
def update_user_approval(sender, instance, action, **kwargs):
    if action in ['post_add', 'post_remove', 'post_clear']:
        has_subdepts = instance.sub_departments.exists()
        # Update active flag based on sub_departments being assigned
        if has_subdepts:
            instance.active = True
        else:
            instance.active = False
        instance.save(update_fields=['active'])

        # Relocate the profile image to correct department/sub-department folder
        move_profile_image_to_correct_path(instance)
