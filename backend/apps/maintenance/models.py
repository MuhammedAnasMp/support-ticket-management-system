from django.db import models
from django.dispatch import receiver


class Priority(models.Model):
    priority_id = models.AutoField(primary_key=True)
    department = models.ForeignKey(
        'stores.Department', on_delete=models.CASCADE, related_name='priorities')
    priority_name = models.CharField(max_length=50)
    level = models.IntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['department', 'priority_name'], name='unique_department_priority_name')
        ]
        permissions = [
            ("view_priority_name", "Can view priority name"),
            ("change_priority_name", "Can change priority name"),
            ("view_level", "Can view level"),
            ("change_level", "Can change level"),
        ]

    def __str__(self):
        return self.priority_name


class Status(models.Model):
    status_id = models.AutoField(primary_key=True)
    status_name = models.CharField(max_length=50)
    active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["status_name"],
                name="unique_status_name"
            )
        ]

    def __str__(self):
        return self.status_name


class StatusChangeRule(models.Model):
    TYPE_CHOICES = [
        ("field", "Field"),
        ("related", "Related"),
    ]

    MODE_CHOICES = [
        ("check", "Check"),
        ("delete", "Delete"),
        ("set", "Set"),
        ("warning", "Warning"),
    ]

    from_status = models.ForeignKey(
        "maintenance.Status",
        on_delete=models.CASCADE,
        related_name="from_rules",
    )

    to_status = models.ForeignKey(
        "maintenance.Status",
        on_delete=models.CASCADE,
        related_name="to_rules",
    )

    mode = models.CharField(
        max_length=10,
        choices=MODE_CHOICES,
        default="check",
        help_text=(
            "Check: validate before status change.\n"
            "Delete: remove related fields/records before status change.\n"
            "Set: set the field/relationship value to value before status change.\n"
            "Warning: warn if condition fails, but allow status change."
        ),
    )

    type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        default="field",
    )

    path = models.CharField(
        max_length=255,
        help_text=(
            "Field/relationship path.\n"
            "Examples:\n"
            "store.name\n"
            "created_by.username\n"
            "attachments.file_name\n"
            "allocations.name"
        ),
    )

    value = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Expected value (used for check, set, and warning modes).",
    )

    message = models.TextField(
        blank=True,
        null=True,
        help_text=(
            "For Check/Warning mode: error/warning message displayed when validation fails.\n"
            "Example: 'Store must be assigned before closing.'\n\n"
            "For Delete mode: describe what will be deleted.\n"
            "Example: 'Delete all attachments and allocations.'"
        ),
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "status_change_rule"

    def __str__(self):
        return f"{self.from_status} → {self.to_status}"


class WorkNature(models.Model):
    nature_id = models.AutoField(primary_key=True)
    nature_name = models.CharField(max_length=255)
    sub_department = models.ForeignKey(
        'stores.SubDepartment', on_delete=models.CASCADE, related_name='work_natures', default=1)
    default_priority = models.ForeignKey(
        Priority, on_delete=models.SET_NULL, null=True, blank=True, related_name='default_natures')
    media_required = models.BooleanField(default=True)
    active = models.BooleanField(default=True)

    class Meta:
        permissions = [
            ("view_nature_name", "Can view nature name"),
            ("change_nature_name", "Can change nature name"),
            ("view_sub_department", "Can view sub department"),
            ("change_sub_department", "Can change sub department"),
            ("view_default_priority", "Can view default priority"),
            ("change_default_priority", "Can change default priority"),
            ("view_active", "Can view active"),
            ("change_active", "Can change active"),
        ]

    def __str__(self):
        return self.nature_name


class NatureWorker(models.Model):
    nature_worker_id = models.AutoField(primary_key=True)
    nature = models.ForeignKey(
        WorkNature, on_delete=models.CASCADE, related_name='nature_workers')
    worker = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='skilled_natures')

    class Meta:
        permissions = [
            ("view_nature", "Can view nature"),
            ("change_nature", "Can change nature"),
            ("view_worker", "Can view worker"),
            ("change_worker", "Can change worker"),
        ]

    def __str__(self):
        return f"{self.nature.nature_name} - {self.worker.username}"


class Ticket(models.Model):
    ticket_id = models.AutoField(primary_key=True)
    work_order_no = models.CharField(max_length=100, unique=True)
    store = models.ForeignKey(
        'stores.Store', on_delete=models.CASCADE, related_name='tickets')
    department = models.ForeignKey(
        'stores.Department', on_delete=models.CASCADE, related_name='tickets')
    nature = models.ForeignKey(
        WorkNature, on_delete=models.CASCADE, related_name='tickets')
    priority = models.ForeignKey(
        Priority, on_delete=models.PROTECT, related_name='tickets')
    status = models.ForeignKey(
        Status, on_delete=models.PROTECT, related_name='tickets')
    title = models.CharField(max_length=255)
    description = models.TextField()
    created_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.PROTECT, related_name='created_tickets')
    created_date = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='approved_tickets')
    approved_date = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='rejected_tickets')
    rejected_date = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(null=True, blank=True)
    closed_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL,
                                  null=True, blank=True, related_name='closed_tickets')
    closed_date = models.DateTimeField(null=True, blank=True)
    location_approval = models.CharField(max_length=100, default='Pending', null=True, blank=True)
    location_approved_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL,
                                             null=True, blank=True, related_name='location_approved_tickets')
    location_approved_date = models.DateTimeField(null=True, blank=True)
    location_reject_reason = models.TextField(null=True, blank=True)

    class Meta:
        permissions = [
            ("view_work_order_no", "Can view work order no"),
            ("change_work_order_no", "Can change work order no"),
            ("view_store", "Can view store"),
            ("change_store", "Can change store"),
            ("view_department", "Can view department"),
            ("change_department", "Can change department"),
            ("view_nature", "Can view nature"),
            ("change_nature", "Can change nature"),
            ("view_priority", "Can view priority"),
            ("change_priority", "Can change priority"),
            ("view_status", "Can view status"),
            ("change_status", "Can change status"),
            ("view_title", "Can view title"),
            ("change_title", "Can change title"),
            ("view_description", "Can view description"),
            ("change_description", "Can change description"),
            ("view_created_by", "Can view created by"),
            ("change_created_by", "Can change created by"),
            ("view_approved_by", "Can view approved by"),
            ("change_approved_by", "Can change approved by"),
            ("view_approved_date", "Can view approved date"),
            ("change_approved_date", "Can change approved date"),
            ("view_rejected_by", "Can view rejected by"),
            ("change_rejected_by", "Can change rejected by"),
            ("view_rejected_date", "Can view rejected date"),
            ("change_rejected_date", "Can change rejected date"),
            ("view_reject_reason", "Can view reject reason"),
            ("change_reject_reason", "Can change reject reason"),
            ("view_closed_by", "Can view closed by"),
            ("change_closed_by", "Can change closed by"),
            ("view_closed_date", "Can view closed date"),
            ("change_closed_date", "Can change closed date"),
            ("create_ticket", "Can create ticket"),
            ("approve_ticket", "Can approve ticket"),
            ("reject_ticket", "Can reject ticket"),
            ("complete_ticket", "Can complete ticket"),
            ("view_all_department_tickets", "Can view all department tickets"),
            ("create_ticket_all_departments",
             "Can create ticket under all departments"),


            ("can_view_open_ticket", "Can view open ticket"),
            ("can_view_reconciled_ticket", "Can view reconciled ticket"),
            ("can_view_in_progress_ticket", "Can view in progress ticket"),
            ("can_view_completed_ticket", "Can view completed ticket"),
            ("can_view_rejected_ticket", "Can view rejected ticket"),
            ("can_view_blocked_ticket", "Can view blocked ticket"),
        ]

    def __str__(self):
        return f"{self.work_order_no} - {self.title}"

    def clean(self):
        super().clean()
        if self.pk:
            old_instance = Ticket.objects.get(pk=self.pk)
            if old_instance.status != self.status:
                from .utils import get_value_from_path, compare_values, set_value_on_path
                from .models import StatusChangeRule
                
                # Apply set rules first
                set_rules = StatusChangeRule.objects.filter(
                    from_status=old_instance.status,
                    to_status=self.status,
                    is_active=True,
                    mode="set"
                )
                for rule in set_rules:
                    set_value_on_path(self, rule.path, rule.value)
                
                # Run check rules validation
                rules = StatusChangeRule.objects.filter(
                    from_status=old_instance.status,
                    to_status=self.status,
                    is_active=True,
                    mode="check"
                )
                from django.core.exceptions import ValidationError
                for rule in rules:
                    val = get_value_from_path(self, rule.path)
                    
                    if rule.value is None or rule.value == "":
                        if rule.type == "field":
                            if val is None or val == "":
                                raise ValidationError(rule.message)
                        elif rule.type == "related":
                            exists = False
                            if hasattr(val, 'exists') and callable(val.exists):
                                exists = val.exists()
                            elif isinstance(val, (list, tuple, set)):
                                exists = len(val) > 0
                            elif val:
                                exists = True
                            if not exists:
                                raise ValidationError(rule.message)
                    else:
                        if not compare_values(val, rule.value):
                            raise ValidationError(rule.message)

    def save(self, *args, **kwargs):
        if self.pk:
            old_instance = Ticket.objects.get(pk=self.pk)
            if old_instance.status != self.status:
                if getattr(self, '_bypass_status_rule', False):
                    super().save(*args, **kwargs)
                    return
                
                new_status = self.status
                self.status = old_instance.status
                
                from .utils import change_status
                change_status(
                    self,
                    new_status,
                    changed_by=getattr(self, '_changed_by', None),
                    remarks=getattr(self, '_remarks', None)
                )
                return
        super().save(*args, **kwargs)



class Allocation(models.Model):
    allocation_id = models.AutoField(primary_key=True)
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name='allocations')
    worker = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='allocations')
    assigned_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, related_name='assigned_allocations')
    assigned_date = models.DateTimeField(auto_now_add=True)
    planned_hours = models.DecimalField(max_digits=5, decimal_places=2)
    remarks = models.TextField(null=True, blank=True)

    class Meta:
        permissions = [
            ("view_ticket", "Can view ticket"),
            ("change_ticket", "Can change ticket"),
            ("view_worker", "Can view worker"),
            ("change_worker", "Can change worker"),
            ("view_assigned_by", "Can view assigned by"),
            ("change_assigned_by", "Can change assigned by"),
            ("view_planned_hours", "Can view planned hours"),
            ("change_planned_hours", "Can change planned hours"),
            ("view_remarks", "Can view remarks"),
            ("change_remarks", "Can change remarks"),
        ]

    def __str__(self):
        return f"Alloc {self.allocation_id} - Ticket {self.ticket.work_order_no} to {self.worker.username}"


@receiver(models.signals.post_save, sender=Allocation)
def add_store_to_worker_accessible_stores(sender, instance, **kwargs):
    if instance.worker and instance.ticket and instance.ticket.store:
        instance.worker.accessible_stores.add(instance.ticket.store)


class WorkLog(models.Model):
    worklog_id = models.AutoField(primary_key=True)
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name='work_logs')
    worker = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='work_logs')
    allocation = models.ForeignKey(
        Allocation, on_delete=models.SET_NULL, null=True, blank=True, related_name='work_logs')
    work_date = models.DateField()
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    labour_amount = models.DecimalField(max_digits=10, decimal_places=2)
    work_done = models.TextField()
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        permissions = [
            ("view_ticket", "Can view ticket"),
            ("change_ticket", "Can change ticket"),
            ("view_worker", "Can view worker"),
            ("change_worker", "Can change worker"),
            ("view_allocation", "Can view allocation"),
            ("change_allocation", "Can change allocation"),
            ("view_work_date", "Can view work date"),
            ("change_work_date", "Can change work date"),
            ("view_hours", "Can view hours"),
            ("change_hours", "Can change hours"),
            ("view_hourly_rate", "Can view hourly rate"),
            ("change_hourly_rate", "Can change hourly rate"),
            ("view_labour_amount", "Can view labour amount"),
            ("change_labour_amount", "Can change labour amount"),
            ("view_work_done", "Can view work done"),
            ("change_work_done", "Can change work done"),
        ]

    def __str__(self):
        return f"WorkLog {self.worklog_id} by {self.worker.username}"


class TicketHistory(models.Model):
    history_id = models.AutoField(primary_key=True)
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name='history')

    # Snapshot of Ticket fields
    store = models.ForeignKey(
        'stores.Store', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_store')
    department = models.ForeignKey(
        'stores.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_department')
    nature = models.ForeignKey(
        WorkNature, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_nature')
    priority = models.ForeignKey(
        Priority, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_priority')
    status = models.ForeignKey(
        Status, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_status')
    title = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_created_tickets')
    created_date = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_approved_tickets')
    approved_date = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_rejected_tickets')
    rejected_date = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_closed_tickets')
    closed_date = models.DateTimeField(null=True, blank=True)
    location_approval = models.CharField(max_length=100, default='Pending', null=True, blank=True)
    location_approved_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_location_approved_tickets')
    location_approved_date = models.DateTimeField(null=True, blank=True)
    location_reject_reason = models.TextField(null=True, blank=True)

    # History metadata fields
    changed_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='ticket_history_changes')
    changed_date = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(null=True, blank=True)
    age_days = models.DecimalField(
        max_digits=10, decimal_places=4, default=0.0)

    class Meta:
        permissions = [
            ("view_ticket", "Can view ticket"),
            ("change_ticket", "Can change ticket"),
            ("view_status", "Can view status"),
            ("change_status", "Can change status"),
            ("view_changed_by", "Can view changed by"),
            ("change_changed_by", "Can change changed by"),
            ("view_remarks", "Can view remarks"),
            ("change_remarks", "Can change remarks"),
        ]

    def __str__(self):
        return f"History {self.history_id} - Ticket {self.ticket.work_order_no}"


@receiver(models.signals.post_save, sender=Ticket)
def create_ticket_history_on_save(sender, instance, created, **kwargs):
    from django.utils import timezone

    # 1. Try to find the last history record for this ticket
    last_history = TicketHistory.objects.filter(
        ticket=instance).order_by('-changed_date').first()

    is_new_status = False
    if created or not last_history or last_history.status != instance.status:
        is_new_status = True

    # 2. If leaving a status, update its age_days
    if last_history and last_history.status != instance.status:
        now = timezone.now()
        duration = now - last_history.changed_date
        session_days = duration.total_seconds() / 86400.0

        # Calculate sum of all previous completed durations for this status
        previous_history = TicketHistory.objects.filter(
            ticket=instance,
            status=last_history.status
        ).exclude(pk=last_history.pk)

        previous_days_sum = sum(
            h.age_days for h in previous_history if h.age_days is not None)

        # Update the last_history record with the accumulated age_days
        last_history.age_days = float(previous_days_sum) + float(session_days)
        last_history.save(update_fields=['age_days'])

    # 3. Create a new history entry as a snapshot
    if is_new_status:
        changed_by = getattr(instance, '_changed_by', None)
        if not changed_by:
            # Pick the most specific actor available on the ticket, in priority order.
            # No status names are hardcoded — purely field-based.
            for actor_field in ('closed_by', 'rejected_by', 'approved_by', 'created_by'):
                actor = getattr(instance, actor_field, None)
                if actor:
                    changed_by = actor
                    break

        remarks = getattr(instance, '_remarks', '')
        if not remarks:
            if instance.reject_reason:
                remarks = instance.reject_reason
            elif instance.status:
                remarks = f"Status changed to {instance.status.status_name}"
            else:
                remarks = "Ticket saved"

        TicketHistory.objects.create(
            ticket=instance,
            store=instance.store,
            department=instance.department,
            nature=instance.nature,
            priority=instance.priority,
            status=instance.status,
            title=instance.title,
            description=instance.description,
            created_by=instance.created_by,
            created_date=instance.created_date,
            approved_by=instance.approved_by,
            approved_date=instance.approved_date,
            rejected_by=instance.rejected_by,
            rejected_date=instance.rejected_date,
            reject_reason=instance.reject_reason,
            closed_by=instance.closed_by,
            closed_date=instance.closed_date,
            location_approval=instance.location_approval,
            location_approved_by=instance.location_approved_by,
            location_approved_date=instance.location_approved_date,
            location_reject_reason=instance.location_reject_reason,
            changed_by=changed_by,
            remarks=remarks,
            age_days=0.0
        )


class TicketChatMessage(models.Model):
    message_id = models.AutoField(primary_key=True)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='chat_messages')
    sender = models.ForeignKey('accounts.CustomUser', on_delete=models.CASCADE, related_name='sent_chat_messages')
    message_text = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='ticket_chats/images/', null=True, blank=True)
    video = models.FileField(upload_to='ticket_chats/videos/', null=True, blank=True)
    voice = models.FileField(upload_to='ticket_chats/voices/', null=True, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_date']

    def __str__(self):
        return f"Msg {self.message_id} on Ticket {self.ticket.work_order_no} by {self.sender.username}"
