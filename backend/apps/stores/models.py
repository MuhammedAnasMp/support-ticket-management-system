from django.dispatch import receiver
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


class StoreType(models.TextChoices):
    SUPER_MARKET = "SUPER_MARKET", "Super Market"
    HYPER_MARKET = "HYPER_MARKET", "Hyper Market"
    WAREHOUSE = "WAREHOUSE", "Warehouse"
    FRESH = "FRESH", "Fresh"
    COSTO = "COSTO", "Costo"
    CAMP = "CAMP", "Camp"


class Store(models.Model):
    store_id = models.CharField(max_length=20, primary_key=True)
    store_name = models.CharField(max_length=255)

    type = models.CharField(
        max_length=20,
        choices=StoreType.choices,
        null=True,
        blank=True,
    )
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
        abbreviation_map = {
            StoreType.FRESH: "FR",
            StoreType.HYPER_MARKET: "HM",
            StoreType.SUPER_MARKET: "SM",
            StoreType.CAMP: "CM",
            StoreType.WAREHOUSE: "WH",
            StoreType.COSTO: "CS",
        }
        suffix = f" ({abbreviation_map[self.type]})" if self.type in abbreviation_map else ""
        return f"{self.store_name}{suffix}"


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


@receiver(models.signals.post_save, sender=SubDepartment)
def sync_subdepartment_to_worknature(sender, instance, created, **kwargs):
    from apps.maintenance.models import WorkNature, Priority

    priority_medium, _ = Priority.objects.get_or_create(
        department=instance.department,
        priority_name="Medium",
        defaults={"level": 3},
    )

    if created:
        WorkNature.objects.create(
            nature_name=f"{instance.sub_department_name} Related",
            sub_department=instance,
            default_priority=priority_medium,
            media_required=True,
            active=True,
        )

    else:
        # Check if at least one WorkNature exists
        if not WorkNature.objects.filter(sub_department=instance).exists():
            WorkNature.objects.create(
                nature_name=f"{instance.sub_department_name} Related",
                sub_department=instance,
                default_priority=priority_medium,
                media_required=True,
                active=True,
            )


@receiver(models.signals.pre_save, sender=Store)
def check_store_manager_contact_pre(sender, instance, **kwargs):
    # Check if store already exists to detect manager change/removal
    if instance.pk:
        try:
            old_instance = Store.objects.get(pk=instance.pk)
            old_manager = old_instance.manager
        except Store.DoesNotExist:
            old_manager = None
    else:
        old_manager = None

    # If the manager was changed or removed, clean up their synced contact details
    if old_manager and old_manager != instance.manager:
        if instance.phone == old_manager.phone:
            instance.phone = None
        old_manager_wa = old_manager.whatsapp_number or old_manager.phone
        if instance.whatsapp_number == old_manager_wa:
            instance.whatsapp_number = None

    # Sync contacts from the new manager if assigned
    if instance.manager:
        manager = instance.manager
        if manager.is_active and getattr(manager, 'active', True):
            if not instance.phone and manager.phone:
                instance.phone = manager.phone
            
            # Use phone as fallback if whatsapp number is missing
            manager_wa = manager.whatsapp_number or manager.phone
            if not instance.whatsapp_number and manager_wa:
                instance.whatsapp_number = manager_wa


@receiver(models.signals.pre_save, sender=settings.AUTH_USER_MODEL)
def store_old_manager_contact(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_user = sender.objects.get(pk=instance.pk)
            instance._old_phone = old_user.phone
            instance._old_whatsapp = old_user.whatsapp_number
        except sender.DoesNotExist:
            pass


@receiver(models.signals.post_save, sender=settings.AUTH_USER_MODEL)
def update_store_contact_from_manager(sender, instance, created, **kwargs):
    if hasattr(instance, 'managed_store') and instance.managed_store:
        store = instance.managed_store
        if instance.is_active and getattr(instance, 'active', True):
            old_phone = getattr(instance, '_old_phone', None)
            old_whatsapp = getattr(instance, '_old_whatsapp', None)
            
            updated = False
            # Update phone if store phone is empty OR matches the manager's old phone
            if (not store.phone or store.phone == old_phone) and instance.phone:
                if store.phone != instance.phone:
                    store.phone = instance.phone
                    updated = True
            
            # Update whatsapp if store whatsapp is empty OR matches the manager's old whatsapp
            manager_wa = instance.whatsapp_number or instance.phone
            old_wa = old_whatsapp or old_phone
            if (not store.whatsapp_number or store.whatsapp_number == old_wa) and manager_wa:
                if store.whatsapp_number != manager_wa:
                    store.whatsapp_number = manager_wa
                    updated = True
                    
            if updated:
                store.save(update_fields=['phone', 'whatsapp_number'])
