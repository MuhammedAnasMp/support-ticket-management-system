from django.db import models
from django.contrib.auth.models import AbstractUser

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
    user_id = models.AutoField(primary_key=True)  # Overriding the default id PK
    employee_no = models.CharField(max_length=50, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, null=True, blank=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    store = models.ForeignKey('stores.Store', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    accessible_stores = models.ManyToManyField('stores.Store', blank=True, related_name='accessible_users')
    sub_departments = models.ManyToManyField('stores.SubDepartment', blank=True, related_name='users')
    active = models.BooleanField(default=True)

    class Meta:
        permissions = [
            ("view_employee_no", "Can view employee no"),
            ("change_employee_no", "Can change employee no"),
            ("view_full_name", "Can view full name"),
            ("change_full_name", "Can change full name"),
            ("view_phone", "Can view phone"),
            ("change_phone", "Can change phone"),
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
