from django.conf import settings
import os
import hashlib
import hmac
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
import threading
import subprocess
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
            old_endpoint = request.data.get("old_endpoint")

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

            if old_endpoint and old_endpoint != endpoint:
                PushSubscription.objects.filter(
                    user=request.user, endpoint=old_endpoint).delete()

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


PROJECT_DIR = r"C:\inetpub\wwwroot\support-ticket-management-system"


def run_command(command, cwd=None):
    result = subprocess.run(
        command,
        cwd=cwd,
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    return {
        "command": command,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "success": result.returncode == 0,
    }


def create_deployment_notification(title, message):
    from apps.common.models import Notification
    User = get_user_model()

    # Notify superusers so they know deployment status
    users = User.objects.filter(is_superuser=True)
    if not users.exists():
        users = User.objects.filter(is_staff=True)
    if not users.exists():
        users = User.objects.all()[:1]

    for user in users:
        try:
            Notification.objects.create(
                user=user,
                notification_type="deployment",
                title=title,
                message=message,
            )
        except Exception as e:
            print("Failed to create deployment notification:", e)


def log_to_file(text):
    log_file_path = os.path.join(PROJECT_DIR, "deploy.log")
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(f"[{timezone.now().isoformat()}] {text}\n\n")
    except Exception as e:
        print("Failed to write to deploy.log file:", e)


def run_deployment():
    start_msg = "Deployment process has started on the server."
    create_deployment_notification("Deployment Started", start_msg)
    log_to_file(f"STATUS: Deployment Started\n{start_msg}")

    logs = []
    commands = [
        (
            "git pull",
            PROJECT_DIR,
        ),
        (
            r"call venv\Scripts\activate && pip install -r requirements.txt",
            rf"{PROJECT_DIR}\backend",
        ),
        (
            "call npm run build",
            rf"{PROJECT_DIR}\frontend",
        ),
        (
            r"call venv\Scripts\activate && python manage.py collectstatic --noinput",
            rf"{PROJECT_DIR}\backend",
        ),
        (
            'powershell -NoProfile -Command "Stop-Service mtracker -Force"',
            PROJECT_DIR,
        ),
        (
            'powershell -NoProfile -Command "Start-Service mtracker"',
            PROJECT_DIR,
        ),
    ]

    try:
        for command, cwd in commands:
            result = run_command(command, cwd)
            log_entry = (
                f"COMMAND: {command}\n"
                f"RETURN CODE: {result['returncode']}\n"
                f"STDOUT:\n{result['stdout']}\n"
                f"STDERR:\n{result['stderr']}\n"
                f"{'='*40}"
            )
            logs.append(log_entry + "\n")
            log_to_file(log_entry)

            if not result["success"]:
                error_msg = result["stderr"] or result["stdout"]
                fail_msg = f"Command '{command}' failed.\n\nError:\n{error_msg}\n\nFull Logs:\n" + "\n".join(
                    logs)
                create_deployment_notification("Deployment Failed", fail_msg)
                log_to_file(f"STATUS: Deployment Failed\n{fail_msg}")
                return

        success_msg = "Deployment completed successfully!\n\nFull Logs:\n" + \
            "\n".join(logs)
        create_deployment_notification("Deployment Success", success_msg)
        log_to_file(f"STATUS: Deployment Success\n{success_msg}")

    except Exception as exc:
        err_msg = f"An unexpected error occurred: {exc}\n\nFull Logs:\n" + "\n".join(
            logs)
        create_deployment_notification("Deployment Failed", err_msg)
        log_to_file(f"STATUS: Deployment Failed\n{err_msg}")


class GithubWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Verify Github Signature if secret is configured
        signature = request.headers.get("X-Hub-Signature-256")
        secret = os.getenv("GITHUB_WEBHOOK_SECRET") or getattr(
            settings, "GITHUB_WEBHOOK_SECRET", None)

        if secret:
            if not signature:
                return Response(
                    {"success": False, "message": "Signature is required when GITHUB_WEBHOOK_SECRET is set."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            try:
                sha_name, signature_hash = signature.split('=')
                if sha_name != 'sha256':
                    return Response(
                        {"success": False,
                            "message": "Only sha256 signature is supported."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                mac = hmac.new(secret.encode('utf-8'),
                               msg=request.body, digestmod=hashlib.sha256)
                if not hmac.compare_digest(mac.hexdigest(), signature_hash):
                    return Response(
                        {"success": False, "message": "Invalid signature check."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Exception as e:
                return Response(
                    {"success": False,
                        "message": f"Verification error: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        thread = threading.Thread(target=run_deployment)
        thread.daemon = True
        thread.start()
        return Response({"success": True, "message": "Deployment triggered."})
