from rest_framework import serializers
from .models import MediaCategory, Media, Notification


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
    class Meta:
        model = Media
        fields = "__all__"

    def validate(self, data):
        # Support both create and update
        ticket = data.get("ticket") or getattr(self.instance, "ticket", None)
        category = data.get("category") or getattr(
            self.instance, "category", None)

        if ticket and category and category.department != ticket.department:
            raise serializers.ValidationError({
                "category": (
                    f"Media Category '{category.category_name}' does not belong "
                    f"to ticket department '{ticket.department.department_name}'."
                )
            })

        return data


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
