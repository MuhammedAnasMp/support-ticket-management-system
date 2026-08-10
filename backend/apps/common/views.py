from .models import PushSubscription
import json
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from .models import MediaCategory, Media, Notification
from .serializers import MediaCategorySerializer, MediaSerializer, NotificationSerializer, MediaWriteSerializer
from apps.stores.models import SubDepartment
from rest_framework.exceptions import ValidationError


class MediaCategoryViewSet(viewsets.ModelViewSet):
    queryset = MediaCategory.objects.all()
    serializer_class = MediaCategorySerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        sub_department_id = self.request.query_params.get("department")

        if sub_department_id:
            try:
                sub_department = SubDepartment.objects.select_related("department").get(
                    pk=sub_department_id
                )
                queryset = queryset.filter(
                    department=sub_department.department)
            except SubDepartment.DoesNotExist:
                raise ValidationError(
                    {"department": "Invalid sub-department ID."}
                )

        return queryset


class MediaViewSet(viewsets.ModelViewSet):
    queryset = Media.objects.all()
    serializer_class = MediaSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MediaWriteSerializer
        return MediaSerializer

    def get_queryset(self):
        queryset = self.queryset

        ticket = self.request.query_params.get("ticket")
        if ticket:
            queryset = queryset.filter(ticket_id=ticket)

        return queryset


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated:
            return self.queryset.filter(user=user)
        return self.queryset.none()



class SubscribePushView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            subscription = request.data.get("subscription")

            if not subscription:
                return Response(
                    {"success": False, "message": "Subscription is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            endpoint = subscription.get("endpoint")
            keys = subscription.get("keys", {})
            p256dh = keys.get("p256dh")
            auth = keys.get("auth")

            if not endpoint:
                return Response(
                    {"success": False, "message": "Endpoint is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not p256dh or not auth:
                return Response(
                    {"success": False, "message": "Subscription keys are required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            PushSubscription.objects.update_or_create(
                endpoint=endpoint,
                defaults={
                    "user": request.user,
                    "p256dh": p256dh,
                    "auth": auth,
                    "is_active": True,
                },
            )

            return Response({"success": True, "message": "Push subscription saved."})

        except Exception as error:
            return Response(
                {"success": False, "message": str(error)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UnsubscribePushView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            endpoint = request.data.get("endpoint")

            if not endpoint:
                return Response(
                    {"success": False, "message": "Endpoint is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            PushSubscription.objects.filter(
                user=request.user,
                endpoint=endpoint,
            ).update(is_active=False)

            return Response({"success": True})

        except Exception as error:
            return Response(
                {"success": False, "message": str(error)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
