from django.db import models

class Priority(models.Model):
    priority_id = models.AutoField(primary_key=True)
    priority_name = models.CharField(max_length=50, unique=True)
    level = models.IntegerField()

    class Meta:
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
    status_name = models.CharField(max_length=50, unique=True)

    class Meta:
        permissions = [
            ("view_status_name", "Can view status name"),
            ("change_status_name", "Can change status name"),
        ]

    def __str__(self):
        return self.status_name

class WorkNature(models.Model):
    nature_id = models.AutoField(primary_key=True)
    nature_name = models.CharField(max_length=255)
    sub_department = models.ForeignKey('stores.SubDepartment', on_delete=models.CASCADE, related_name='work_natures', default=1)
    default_priority = models.ForeignKey(Priority, on_delete=models.SET_NULL, null=True, blank=True, related_name='default_natures')
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
    nature = models.ForeignKey(WorkNature, on_delete=models.CASCADE, related_name='nature_workers')
    worker = models.ForeignKey('accounts.CustomUser', on_delete=models.CASCADE, related_name='skilled_natures')

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
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='tickets')
    department = models.ForeignKey('stores.Department', on_delete=models.CASCADE, related_name='tickets')
    nature = models.ForeignKey(WorkNature, on_delete=models.CASCADE, related_name='tickets')
    priority = models.ForeignKey(Priority, on_delete=models.PROTECT, related_name='tickets')
    status = models.ForeignKey(Status, on_delete=models.PROTECT, related_name='tickets')
    title = models.CharField(max_length=255)
    description = models.TextField()
    created_by = models.ForeignKey('accounts.CustomUser', on_delete=models.PROTECT, related_name='created_tickets')
    created_date = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_tickets')
    approved_date = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_tickets')
    rejected_date = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(null=True, blank=True)
    closed_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_tickets')
    closed_date = models.DateTimeField(null=True, blank=True)

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
        ]

    def __str__(self):
        return f"{self.work_order_no} - {self.title}"

class Allocation(models.Model):
    allocation_id = models.AutoField(primary_key=True)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='allocations')
    worker = models.ForeignKey('accounts.CustomUser', on_delete=models.CASCADE, related_name='allocations')
    assigned_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL, null=True, related_name='assigned_allocations')
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

class WorkLog(models.Model):
    worklog_id = models.AutoField(primary_key=True)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='work_logs')
    worker = models.ForeignKey('accounts.CustomUser', on_delete=models.CASCADE, related_name='work_logs')
    allocation = models.ForeignKey(Allocation, on_delete=models.SET_NULL, null=True, blank=True, related_name='work_logs')
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
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='history')
    status = models.ForeignKey(Status, on_delete=models.PROTECT, related_name='history')
    changed_by = models.ForeignKey('accounts.CustomUser', on_delete=models.PROTECT, related_name='ticket_history_changes')
    changed_date = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(null=True, blank=True)

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
