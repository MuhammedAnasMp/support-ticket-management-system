from rest_framework import serializers
from .models import MediaCategory, Media, Notification
from apps.accounts.models import CustomUser


class MediaCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaCategory
        fields = '__all__'
        depth = 1


class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Media
        fields = "__all__"
        depth = 1

class MediaWriteSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(), required=False
    )

    class Meta:
        model = Media
        fields = "__all__"

    def validate(self, data):
        # Support both create and update
        ticket = data.get("ticket") or getattr(self.instance, "ticket", None)
        category = data.get("category") or getattr(self.instance, "category", None)

        if ticket and category and category.department_id != ticket.department_id:
            matching_cat = MediaCategory.objects.filter(
                department=ticket.department,
                category_name__iexact=category.category_name
            ).first()
            if matching_cat:
                data["category"] = matching_cat

        return data


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
