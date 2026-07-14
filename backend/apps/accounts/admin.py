from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Role, CustomUser

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('role_id', 'role_name')
    search_fields = ('role_name',)

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ('user_id', 'username', 'email', 'employee_no', 'full_name', 'phone', 'role', 'store', 'active', 'is_staff')
    list_filter = ('active', 'is_staff', 'is_superuser', 'role', 'store')
    search_fields = ('username', 'email', 'employee_no', 'full_name', 'phone')
    
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Info', {
            'fields': ('employee_no', 'full_name', 'phone', 'role', 'store', 'accessible_stores', 'sub_departments', 'active')
        }),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Custom Info', {
            'fields': ('employee_no', 'full_name', 'phone', 'role', 'store', 'accessible_stores', 'sub_departments', 'active')
        }),
    )
    filter_horizontal = ('accessible_stores', 'sub_departments')
