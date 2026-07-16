from django.contrib import admin
from .models import Priority, Status, WorkNature, NatureWorker, Ticket, Allocation, WorkLog, TicketHistory

@admin.register(Priority)
class PriorityAdmin(admin.ModelAdmin):
    list_display = ('priority_id', 'department', 'priority_name', 'level')
    list_filter = ('department',)
    search_fields = ('priority_name',)

@admin.register(Status)
class StatusAdmin(admin.ModelAdmin):
    list_display = ('status_id', 'department', 'status_name')
    list_filter = ('department',)
    search_fields = ('status_name',)

@admin.register(WorkNature)
class WorkNatureAdmin(admin.ModelAdmin):
    list_display = ('nature_id', 'nature_name', 'department', 'sub_department', 'default_priority', 'active')
    list_filter = ('active', 'sub_department')
    search_fields = ('nature_name',)

    def department(self, obj):
        return obj.sub_department.department.department_name
    department.short_description = 'Department'

@admin.register(NatureWorker)
class NatureWorkerAdmin(admin.ModelAdmin):
    list_display = ('nature_worker_id', 'nature', 'worker')
    list_filter = ('nature', 'worker')
    search_fields = ('nature__nature_name', 'worker__username')

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('ticket_id', 'work_order_no', 'store', 'department', 'nature', 'priority', 'status', 'created_by', 'created_date')
    list_filter = ('priority', 'status', 'store', 'department', 'created_date')
    search_fields = ('work_order_no', 'title', 'description', 'created_by__username')

@admin.register(Allocation)
class AllocationAdmin(admin.ModelAdmin):
    list_display = ('allocation_id', 'ticket', 'worker', 'assigned_by', 'assigned_date', 'planned_hours')
    list_filter = ('assigned_date', 'worker')
    search_fields = ('ticket__work_order_no', 'worker__username', 'assigned_by__username')

@admin.register(WorkLog)
class WorkLogAdmin(admin.ModelAdmin):
    list_display = ('worklog_id', 'ticket', 'worker', 'work_date', 'hours', 'hourly_rate', 'labour_amount')
    list_filter = ('work_date', 'worker')
    search_fields = ('ticket__work_order_no', 'worker__username')

@admin.register(TicketHistory)
class TicketHistoryAdmin(admin.ModelAdmin):
    list_display = ('history_id', 'ticket', 'status', 'changed_by', 'changed_date', 'remarks')
    list_filter = ('changed_date', 'status')
    search_fields = ('ticket__work_order_no', 'changed_by__username')
