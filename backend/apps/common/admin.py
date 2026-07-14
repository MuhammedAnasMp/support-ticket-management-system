from django.contrib import admin
from .models import MediaCategory, Media, Notification

@admin.register(MediaCategory)
class MediaCategoryAdmin(admin.ModelAdmin):
    list_display = ('category_id', 'category_name')
    search_fields = ('category_name',)

@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ('media_id', 'file_name', 'ticket', 'expense', 'uploaded_by', 'category', 'uploaded_date')
    list_filter = ('category', 'uploaded_date')
    search_fields = ('file_name', 'ticket__work_order_no', 'uploaded_by__username')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('notification_id', 'user', 'ticket', 'notification_type', 'title', 'is_read', 'created_date')
    list_filter = ('notification_type', 'is_read', 'created_date')
    search_fields = ('user__username', 'ticket__work_order_no', 'title', 'message')
