from django.contrib import admin
from .models import ExpenseType, EmployeeRate, Expense, Reconciliation, WorkerClaim


@admin.register(ExpenseType)
class ExpenseTypeAdmin(admin.ModelAdmin):
    list_display = ('expense_type_id', 'department',
                    'expense_name', 'parent', 'required', 'approve_required')
    list_filter = ('department', 'required', 'parent')
    search_fields = ('expense_name',)


@admin.register(EmployeeRate)
class EmployeeRateAdmin(admin.ModelAdmin):
    list_display = ('rate_id', 'worker', 'hourly_rate',
                    'effective_from', 'effective_to')
    list_filter = ('effective_from', 'worker')
    search_fields = ('worker__username',)


@admin.register(WorkerClaim)
class WorkerClaimAdmin(admin.ModelAdmin):
    list_display = ('claim_id', 'ticket', 'worker', 'total_claimed_amount', 'status', 'claim_date', 'approved_by')
    list_filter = ('status', 'claim_date')
    search_fields = ('ticket__work_order_no', 'worker__username')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('expense_id', 'ticket', 'worker', 'expense_type', 'amount',
                    'responsible_store', 'expense_date', 'approved', 'approved_by', 'is_claimed', 'claim')
    list_filter = ('approved', 'is_claimed', 'expense_date',
                   'expense_type', 'responsible_store')
    search_fields = ('ticket__work_order_no', 'worker__username')


@admin.register(Reconciliation)
class ReconciliationAdmin(admin.ModelAdmin):
    list_display = ('reconciliation_id', 'ticket', 'verified_by', 'labour_total',
                    'expense_total', 'material_total', 'grand_total',
                    'claimed_labour_total', 'claimed_expense_total', 'total_claimed_amount',
                    'net_payable_amount', 'verified_date', 'completed')
    list_filter = ('completed', 'verified_date')
    search_fields = ('ticket__work_order_no', 'verified_by__username')

