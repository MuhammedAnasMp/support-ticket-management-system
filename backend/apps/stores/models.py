from django.db import models
from django.core.validators import RegexValidator
from django.conf import settings

phone_validator = RegexValidator(
    regex=r'^\d{8}$',
    message='Phone number must be exactly 8 digits.'
)

whatsapp_validator = RegexValidator(
    regex=r'^\d{8}$|^\d{10}$',
    message='WhatsApp number must be either 8 or 10 digits.'
)


class Area(models.Model):
    area_id = models.AutoField(primary_key=True)
    area_name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.area_name


class Store(models.Model):
    store_id = models.CharField(max_length=20, primary_key=True)
    store_name = models.CharField(max_length=255)
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stores'
    )
    address = models.TextField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True,
                             blank=True, validators=[phone_validator])
    whatsapp_number = models.CharField(
        max_length=50, null=True, blank=True, validators=[whatsapp_validator])
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True)
    manager = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_store'
    )
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.store_name


class Department(models.Model):
    department_id = models.AutoField(primary_key=True)
    department_name = models.CharField(max_length=255)

    def __str__(self):
        return self.department_name


class SubDepartment(models.Model):
    sub_department_id = models.AutoField(primary_key=True)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name='sub_departments')
    sub_department_name = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.department.department_name} - {self.sub_department_name}"
