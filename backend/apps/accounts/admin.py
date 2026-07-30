from django.contrib.auth.models import Permission
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Role, CustomUser, PasswordResetOTP, WhatsAppLog


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('role_id', 'role_name')
    search_fields = ('role_name',)


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ('user_id', 'username', 'email', 'employee_no', 'full_name',
                    'phone', 'whatsapp_number', 'profile_image', 'role', 'active', 'is_staff')
    list_filter = ('active', 'is_staff', 'is_superuser', 'role')
    search_fields = ('username', 'email', 'employee_no', 'full_name', 'phone')

    fieldsets = UserAdmin.fieldsets + (
        ('Custom Info', {
            'fields': ('employee_no', 'full_name', 'phone', 'whatsapp_number', 'profile_image', 'role', 'accessible_stores', 'sub_departments', 'active')
        }),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Custom Info', {
            'fields': ('employee_no', 'full_name', 'phone', 'whatsapp_number', 'profile_image', 'role', 'accessible_stores', 'sub_departments', 'active')
        }),
    )
    filter_horizontal = ('accessible_stores', 'sub_departments')


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'otp', 'is_used', 'created_at')
    list_filter = ('is_used', 'created_at')
    search_fields = ('user__username', 'user__employee_no', 'otp')
    readonly_fields = ('created_at',)


@admin.register(WhatsAppLog)
class WhatsAppLogAdmin(admin.ModelAdmin):
    list_display = ('whatsapp_number', 'user',
                    'message_type', 'status', 'created_at')
    list_filter = ('status', 'message_type', 'created_at')
    search_fields = ('whatsapp_number', 'user__username',
                     'user__employee_no', 'otp')
    readonly_fields = ('created_at',)


admin.site.register(Permission)
