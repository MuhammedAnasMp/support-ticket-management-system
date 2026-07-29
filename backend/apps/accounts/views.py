from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
import re
from .models import Role, CustomUser, PasswordResetOTP, WhatsAppLog
from .serializers import RoleSerializer, CustomUserSerializer


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.exclude(pk=1)
    serializer_class = RoleSerializer


class CustomUserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return CustomUser.objects.none()

        if user.is_superuser:
            return CustomUser.objects.all()

        user_groups_lower = set(g.name.lower() for g in user.groups.all())
        can_view_all = (
            user.has_perm('maintenance.view_all_department_tickets') or
            user.has_perm('maintenance.create_ticket_all_departments') or
            'main_admin' in user_groups_lower or
            'main administrator' in user_groups_lower
        )
        if can_view_all:
            return CustomUser.objects.all()

        user_dept_ids = list(user.sub_departments.values_list('department_id', flat=True))
        if user_dept_ids:
            return CustomUser.objects.filter(sub_departments__department_id__in=user_dept_ids).distinct()

        return CustomUser.objects.filter(pk=user.pk)


class SignupView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from apps.stores.models import Store, Department
        roles = Role.objects.exclude(pk=1).values('role_id', 'role_name')
        stores = Store.objects.all().values('store_id', 'store_name')
        departments = Department.objects.all().values('department_id', 'department_name')
        return Response({
            "roles": list(roles),
            "stores": list(stores),
            "departments": list(departments)
        })

    def post(self, request):
        from apps.stores.models import Store, SubDepartment
        employee_no = request.data.get('employee_no')
        full_name = request.data.get('full_name')
        email = request.data.get('email')
        phone = request.data.get('phone')
        whatsapp_number = request.data.get('whatsapp_number')
        password = request.data.get('password')
        profile_image = request.FILES.get('profile_image')
        role_id = request.data.get('role')
        store_id = request.data.get('store')
        department_id = request.data.get('department')

        # Validation checks
        if not all([employee_no, full_name, email, phone, whatsapp_number, password]) or not profile_image:
            return Response(
                {"error": "All fields including the profile image are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate phone (exactly 8 digits)
        if not re.match(r'^\d{8}$', phone):
            return Response(
                {"error": "Phone number must be exactly 8 digits."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate whatsapp_number (8 or 10 digits)
        if not re.match(r'^\d{8}$|^\d{10}$', whatsapp_number):
            return Response(
                {"error": "WhatsApp number must be either 8 or 10 digits."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if employee_no already exists
        if CustomUser.objects.filter(employee_no=employee_no).exists():
            return Response(
                {"error": "User with this Employee Number already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email already exists
        if CustomUser.objects.filter(email=email).exists():
            return Response(
                {"error": "User with this Email Address already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create user
        try:
            role = Role.objects.get(pk=role_id) if role_id else None

            user = CustomUser.objects.create(
                username=employee_no,
                employee_no=employee_no,
                full_name=full_name,
                email=email,
                phone=phone,
                whatsapp_number=whatsapp_number,
                role=role,
                active=False  # Defaults to inactive / waiting approval
            )
            user.set_password(password)
            if profile_image:
                user.profile_image = profile_image
            user.save()

            if department_id:
                sub_depts = SubDepartment.objects.filter(department_id=department_id)
                user.sub_departments.set(sub_depts)

            return Response(
                {"message": "Waiting for the approval.", "approved": False},
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        employee_no = request.data.get('employee_no')
        password = request.data.get('password')

        if not employee_no or not password:
            return Response(
                {"error": "Please provide both employee number and password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(username=employee_no, password=password)

        if user is None:
            return Response(
                {"error": "Invalid employee number or password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check active status
        if not user.active:
            return Response(
                {"error": "Waiting for the approval.", "approved": False},
                status=status.HTTP_403_FORBIDDEN
            )

        # Generate or get token
        token, created = Token.objects.get_or_create(user=user)

        # Build image URL if it exists
        profile_image_url = None
        if user.profile_image:
            try:
                profile_image_url = request.build_absolute_uri(
                    user.profile_image.url)
            except Exception:
                profile_image_url = user.profile_image.url

        return Response({
            "token": token.key,
            "permissions": list(user.get_all_permissions()),
            "accessible_stores": [{"store_id": s.store_id, "store_name": s.store_name} for s in user.accessible_stores.all()],
            "user": {
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email,
                "employee_no": user.employee_no,
                "full_name": user.full_name,
                "phone": user.phone,
                "whatsapp_number": user.whatsapp_number,
                "role": user.role.role_name if user.role else None,
                "active": user.active,
                "is_superuser": user.is_superuser,
                "profile_image": profile_image_url,
                "sub_departments": [sd.sub_department_name for sd in user.sub_departments.all()],
                "natures": [sn.nature.nature_name for sn in user.skilled_natures.select_related('nature').all()],
                "tickets_created_count": user.created_tickets.count(),
                "tickets_assigned_count": user.allocations.count(),
            }
        }, status=status.HTTP_200_OK)


class ProfileView(APIView):
    def get(self, request):
        user = request.user
        if not user or user.is_anonymous:
            return Response(
                {"error": "Unauthorized"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Build image URL if it exists
        profile_image_url = None
        if user.profile_image:
            try:
                profile_image_url = request.build_absolute_uri(
                    user.profile_image.url)
            except Exception:
                profile_image_url = user.profile_image.url

        return Response({
            "permissions": list(user.get_all_permissions()),
            "accessible_stores": [{"store_id": s.store_id, "store_name": s.store_name} for s in user.accessible_stores.all()],
            "user": {
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email,
                "employee_no": user.employee_no,
                "full_name": user.full_name,
                "phone": user.phone,
                "whatsapp_number": user.whatsapp_number,
                "role": user.role.role_name if user.role else None,
                "active": user.active,
                "is_superuser": user.is_superuser,
                "profile_image": profile_image_url,
                "sub_departments": [sd.sub_department_name for sd in user.sub_departments.all()],
                "natures": [sn.nature.nature_name for sn in user.skilled_natures.select_related('nature').all()],
                "tickets_created_count": user.created_tickets.count(),
                "tickets_assigned_count": user.allocations.count(),
            }
        }, status=status.HTTP_200_OK)


def send_whatsapp_otp(whatsapp_number, otp, user=None):
    import urllib.request
    import json
    from django.conf import settings
    import os
    from django.utils import timezone

    # Clean/format the phone number (Kuwait country code is +965)
    to_number = str(whatsapp_number).strip()
    if not to_number.startswith('+'):
        if len(to_number) == 8:
            to_number = f"+965{to_number}"
        else:
            if to_number.startswith('965'):
                to_number = f"+{to_number}"
            else:
                to_number = f"+965{to_number}"

    url = "https://rcmapi.instaalerts.zone/services/rcm/sendMessage"
    token = os.getenv("WHATSAPP_API_TOKEN", "Bearer 4MQK252vVnF8HaO0tfqTXQ==")
    headers = {
        "Content-Type": "application/json",
        "Authentication": token
    }

    payload = {
        "message": {
            "channel": "WABA",
            "content": {
                "preview_url": True,
                "shorten_url": False,
                "type": "MEDIA_TEMPLATE",
                "mediaTemplate": {
                    "templateId": "grandhyperotp",
                    "bodyParameterValues": {
                        "0": f"SMS - {otp}"
                    },
                    "buttons": {
                        "actions": [
                            {
                                "type": "url",
                                "index": "0",
                                "payload": otp
                            }
                        ]
                    }
                }
            },
            "recipient": {
                "to": to_number,
                "recipient_type": "individual",
                "reference": {
                    "cust_ref": f"cust_{to_number.replace('+', '')}",
                    "messageTag1": "Message Tag 001",
                    "conversationId": f"Conv_{otp}"
                }
            },
            "sender": {
                "from": "96566302741"
            },
            "smsFallback": {
                "sender": "Grand Hyper",
                "destination": to_number,
                "message": f"Your GrandHyper OTP code is - {otp}"
            }
        },
        "metaData": {
            "version": "v1.0.9"
        }
    }

    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode('utf-8')
            print(
                f"\n========================================\n[WHATSAPP SENT via InstaAlerts to {to_number}]\nResponse: {res_body}\n========================================\n")

            # Log locally for reference/fallback
            log_path = os.path.join(settings.BASE_DIR, 'whatsapp_messages.log')
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(
                    f"{timezone.now()} - To: {to_number} - OTP: {otp} - Response: {res_body}\n")

            # Save log in the database
            WhatsAppLog.objects.create(
                user=user,
                whatsapp_number=to_number,
                otp=otp,
                payload=json.dumps(payload),
                response=res_body,
                status='success'
            )

            return True, res_body
    except Exception as e:
        error_msg = str(e)
        if hasattr(e, 'read'):
            try:
                error_body = e.read().decode('utf-8')
                error_msg += f" - Body: {error_body}"
            except Exception:
                pass
        print(f"\nError sending WhatsApp OTP to {to_number}: {error_msg}\n")

        # Log error locally
        try:
            log_path = os.path.join(settings.BASE_DIR, 'whatsapp_messages.log')
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(
                    f"{timezone.now()} - To: {to_number} - OTP: {otp} - Error: {error_msg}\n")
        except Exception:
            pass

        # Save failed log in the database
        try:
            WhatsAppLog.objects.create(
                user=user,
                whatsapp_number=to_number,
                otp=otp,
                payload=json.dumps(payload),
                response=error_msg,
                status='failed'
            )
        except Exception as db_err:
            print(f"Failed to save WhatsAppLog to DB: {db_err}")

        return False, error_msg


class ForgotPasswordView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        employee_no = request.data.get('employee_no')
        if not employee_no:
            return Response(
                {"error": "Please provide employee number."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = CustomUser.objects.get(employee_no=employee_no)
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User with this Employee Number does not exist."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.whatsapp_number:
            return Response(
                {"error": "No WhatsApp number configured for this account. Please contact an admin."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Deactivate previous OTPs
        PasswordResetOTP.objects.filter(
            user=user, is_used=False).update(is_used=True)

        # Generate new OTP
        import random
        otp = str(random.randint(100000, 999999))
        PasswordResetOTP.objects.create(user=user, otp=otp)

        # Send WhatsApp message
        send_whatsapp_otp(user.whatsapp_number, otp, user=user)

        # Mask WhatsApp number for privacy, e.g. 98765432 -> ******32
        num_str = str(user.whatsapp_number)
        masked_number = "*" * (len(num_str) - 2) + \
            num_str[-2:] if len(num_str) > 2 else num_str

        return Response({
            "message": "Verification code sent to your registered WhatsApp number.",
            "whatsapp_number_masked": masked_number
        }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        employee_no = request.data.get('employee_no')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')

        if not all([employee_no, otp, new_password]):
            return Response(
                {"error": "Please provide employee number, verification code, and new password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = CustomUser.objects.get(employee_no=employee_no)
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User with this Employee Number does not exist."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find the latest unused OTP
        otp_record = PasswordResetOTP.objects.filter(
            user=user, otp=otp, is_used=False).first()

        if not otp_record or not otp_record.is_valid():
            return Response(
                {"error": "Invalid or expired verification code."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update password
        user.set_password(new_password)
        user.save()

        # Mark OTP as used
        otp_record.is_used = True
        otp_record.save()

        return Response({
            "message": "Password reset successful. You can now login with your new password."
        }, status=status.HTTP_200_OK)
