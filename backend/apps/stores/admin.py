from django.contrib import admin
from .models import Store, Department, SubDepartment

@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('store_id', 'store_name', 'address', 'phone', 'whatsapp_number', 'active')
    list_filter = ('active',)
    search_fields = ('store_name', 'address', 'phone', 'whatsapp_number')

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('department_id', 'department_name')
    search_fields = ('department_name',)

@admin.register(SubDepartment)
class SubDepartmentAdmin(admin.ModelAdmin):
    list_display = ('sub_department_id', 'department', 'sub_department_name')
    list_filter = ('department',)
    search_fields = ('sub_department_name', 'department__department_name')
