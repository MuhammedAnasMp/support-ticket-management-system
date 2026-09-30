from django.contrib import admin
from .models import (
    ExpenseType, EmployeeRate, Expense, Reconciliation, WorkerClaim,
    LedgerGroup, Ledger, ApprovalWorkflow, ApprovalStep,
    ApprovalInstance, AuditEvent, Payment
)


@admin.register(ExpenseType)
class ExpenseTypeAdmin(admin.ModelAdmin):
    list_display = ('expense_type_id', 'department', 'expense_name', 'parent', 'required', 'approve_required')
    list_filter = ('department', 'required', 'parent')
    search_fields = ('expense_name',)


@admin.register(EmployeeRate)
class EmployeeRateAdmin(admin.ModelAdmin):
    list_display = ('rate_id', 'worker', 'hourly_rate', 'effective_from', 'effective_to')
    list_filter = ('effective_from', 'worker')
    search_fields = ('worker__username',)


@admin.register(WorkerClaim)
class WorkerClaimAdmin(admin.ModelAdmin):
    list_display = ('claim_id', 'worker', 'ticket', 'total_claimed_amount', 'status', 'claim_date', 'submitted_at', 'approved_by')
    list_filter = ('status', 'claim_date', 'period_from', 'period_to')
    search_fields = ('ticket__work_order_no', 'worker__username', 'claim_id')
    raw_id_fields = ('worker', 'ticket', 'approved_by', 'submitted_by')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('expense_id', 'ticket', 'worker', 'added_by', 'expense_type', 'amount',
                    'responsible_store', 'expense_date', 'approved', 'is_claimed', 'claim')
    list_filter = ('approved', 'is_claimed', 'expense_date', 'expense_type', 'responsible_store')
    search_fields = ('ticket__work_order_no', 'worker__username', 'expense_id')
    raw_id_fields = ('ticket', 'worker', 'added_by', 'claim', 'responsible_store')


@admin.register(Reconciliation)
class ReconciliationAdmin(admin.ModelAdmin):
    list_display = ('reconciliation_id', 'ticket', 'verified_by', 'labour_total',
                    'expense_total', 'material_total', 'grand_total',
                    'net_payable_amount', 'verified_date', 'completed')
    list_filter = ('completed', 'verified_date')
    search_fields = ('ticket__work_order_no', 'verified_by__username')


@admin.register(LedgerGroup)
class LedgerGroupAdmin(admin.ModelAdmin):
    list_display = ('ledger_group_id', 'group_name', 'total_amount', 'created_by', 'created_at')
    search_fields = ('group_name',)


@admin.register(Ledger)
class LedgerAdmin(admin.ModelAdmin):
    list_display = ('ledger_id', 'ledger_group', 'total_amount', 'status', 'created_by', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('ledger_id', 'ledger_group__group_name', 'created_by__username')
    filter_horizontal = ('bundles',)


class ApprovalStepInline(admin.TabularInline):
    model = ApprovalStep
    extra = 1
    ordering = ('step_order',)


@admin.register(ApprovalWorkflow)
class ApprovalWorkflowAdmin(admin.ModelAdmin):
    list_display = ('workflow_id', 'name', 'entity_type', 'is_active', 'created_at')
    list_filter = ('entity_type', 'is_active')
    inlines = [ApprovalStepInline]


@admin.register(ApprovalStep)
class ApprovalStepAdmin(admin.ModelAdmin):
    list_display = ('step_id', 'workflow', 'step_order', 'step_name', 'assigned_role', 'is_final_step')
    list_filter = ('workflow', 'assigned_role')
    ordering = ('workflow', 'step_order')


@admin.register(ApprovalInstance)
class ApprovalInstanceAdmin(admin.ModelAdmin):
    list_display = ('instance_id', 'step', 'claim', 'ledger', 'status', 'action_by', 'actioned_at')
    list_filter = ('status', 'created_at')
    search_fields = ('claim__claim_id', 'ledger__ledger_id', 'action_by__username')


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ('event_id', 'entity_name', 'entity_id', 'action', 'actor', 'timestamp', 'ip_address')
    list_filter = ('entity_name', 'action', 'timestamp')
    search_fields = ('entity_id', 'actor__username', 'action')
    readonly_fields = [f.name for f in AuditEvent._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('payment_id', 'amount_paid', 'payment_method', 'transaction_reference', 'claim', 'ledger', 'expense', 'paid_by', 'paid_at')
    list_filter = ('payment_method', 'paid_at')
    search_fields = ('transaction_reference', 'claim__claim_id', 'ledger__ledger_id', 'paid_by__username')
