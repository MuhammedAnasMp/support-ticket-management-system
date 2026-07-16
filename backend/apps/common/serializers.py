from rest_framework import serializers
from .models import MediaCategory, Media, Notification

class MediaCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaCategory
        fields = '__all__'

class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Media
        fields = '__all__'

    def validate(self, data):
        ticket = data.get('ticket')
        category = data.get('category')
        if ticket and category and category.department != ticket.department:
            raise serializers.ValidationError(
                {"category": f"Media Category '{category.category_name}' does not belong to ticket department '{ticket.department.department_name}'."}
            )
        return data

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
