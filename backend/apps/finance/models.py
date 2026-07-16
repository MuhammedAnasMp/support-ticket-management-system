from django.db import models, transaction
from django.conf import settings
from datetime import timedelta

class ExpenseType(models.Model):
    expense_type_id = models.AutoField(primary_key=True)
    department = models.ForeignKey('stores.Department', on_delete=models.CASCADE, related_name='expense_types')
    expense_name = models.CharField(max_length=100)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_types')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['department', 'expense_name'], name='unique_department_expense_name')
        ]
        permissions = [
            ('view_expense_name', 'Can view expense name'),
            ('change_expense_name', 'Can change expense name'),
            ('view_parent', 'Can view parent'),
            ('change_parent', 'Can change parent'),
        ]

    def __str__(self):
        return f"{self.parent.expense_name} > {self.expense_name}" if self.parent else self.expense_name

class EmployeeRate(models.Model):
    rate_id = models.AutoField(primary_key=True)
    worker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rates')
    hourly_rate = models.DecimalField(decimal_places=2, max_digits=10)
    effective_from = models.DateField()
    effective_to = models.DateField(blank=True, null=True)

    class Meta:
        permissions = [
            ('view_worker', 'Can view worker'),
            ('change_worker', 'Can change worker'),
            ('view_hourly_rate', 'Can view hourly rate'),
            ('change_hourly_rate', 'Can change hourly rate'),
            ('view_effective_from', 'Can view effective from'),
            ('change_effective_from', 'Can change effective from'),
            ('view_effective_to', 'Can view effective to'),
            ('change_effective_to', 'Can change effective to'),
        ]

    def __str__(self):
        return f"{self.worker.username} - {self.hourly_rate}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if is_new:
            with transaction.atomic():
                previous_rate = EmployeeRate.objects.filter(
                    worker=self.worker,
                    effective_from__lt=self.effective_from
                ).order_by('-effective_from').first()

                if previous_rate and (previous_rate.effective_to is None or previous_rate.effective_to >= self.effective_from):
                    previous_rate.effective_to = self.effective_from - timedelta(days=1)
                    previous_rate.save(update_fields=['effective_to'])

                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

class Expense(models.Model):
    expense_id = models.AutoField(primary_key=True)
    ticket = models.ForeignKey('maintenance.Ticket', on_delete=models.CASCADE, related_name='expenses')
    worker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expenses')
    expense_type = models.ForeignKey(ExpenseType, on_delete=models.PROTECT, related_name='expenses')
    amount = models.DecimalField(decimal_places=2, max_digits=10)
    expense_date = models.DateField()
    remarks = models.TextField(blank=True, null=True)
    receipt = models.ForeignKey('common.Media', on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_expenses')
    responsible_store = models.ForeignKey('stores.Store', on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')

    class Meta:
        permissions = [
            ('view_ticket', 'Can view ticket'),
            ('change_ticket', 'Can change ticket'),
            ('view_worker', 'Can view worker'),
            ('change_worker', 'Can change worker'),
            ('view_expense_type', 'Can view expense type'),
            ('change_expense_type', 'Can change expense type'),
            ('view_amount', 'Can view amount'),
            ('change_amount', 'Can change amount'),
            ('view_expense_date', 'Can view expense date'),
            ('change_expense_date', 'Can change expense date'),
            ('view_remarks', 'Can view remarks'),
            ('change_remarks', 'Can change remarks'),
            ('view_receipt', 'Can view receipt'),
            ('change_receipt', 'Can change receipt'),
            ('view_approved', 'Can view approved'),
            ('change_approved', 'Can change approved'),
            ('view_approved_by', 'Can view approved by'),
            ('change_approved_by', 'Can change approved by'),
            ('view_responsible_store', 'Can view responsible store'),
            ('change_responsible_store', 'Can change responsible store'),
        ]

    def __str__(self):
        return f"Expense {self.expense_id} - {self.amount}"

class Reconciliation(models.Model):
    reconciliation_id = models.AutoField(primary_key=True)
    ticket = models.OneToOneField('maintenance.Ticket', on_delete=models.CASCADE, related_name='reconciliation')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='verifications')
    labour_total = models.DecimalField(decimal_places=2, max_digits=12)
    expense_total = models.DecimalField(decimal_places=2, max_digits=12)
    material_total = models.DecimalField(decimal_places=2, max_digits=12)
    grand_total = models.DecimalField(decimal_places=2, max_digits=12)
    remarks = models.TextField(blank=True, null=True)
    verified_date = models.DateTimeField(auto_now_add=True)
    completed = models.BooleanField(default=False)

    class Meta:
        permissions = [
            ('view_ticket', 'Can view ticket'),
            ('change_ticket', 'Can change ticket'),
            ('view_verified_by', 'Can view verified by'),
            ('change_verified_by', 'Can change verified by'),
            ('view_labour_total', 'Can view labour total'),
            ('change_labour_total', 'Can change labour total'),
            ('view_expense_total', 'Can view expense total'),
            ('change_expense_total', 'Can change expense total'),
            ('view_material_total', 'Can view material total'),
            ('change_material_total', 'Can change material total'),
            ('view_grand_total', 'Can view grand total'),
            ('change_grand_total', 'Can change grand total'),
            ('view_remarks', 'Can view remarks'),
            ('change_remarks', 'Can change remarks'),
            ('view_completed', 'Can view completed'),
            ('change_completed', 'Can change completed'),
        ]

    def __str__(self):
        return f"Reconciliation {self.reconciliation_id} - Ticket {self.ticket.work_order_no}"
