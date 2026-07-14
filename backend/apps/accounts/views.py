from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
import re
from .models import Role, CustomUser
from .serializers import RoleSerializer, CustomUserSerializer

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

class CustomUserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer

class SignupView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        employee_no = request.data.get('employee_no')
        full_name = request.data.get('full_name')
        email = request.data.get('email')
        phone = request.data.get('phone')
        whatsapp_number = request.data.get('whatsapp_number')
        password = request.data.get('password')
        profile_image = request.FILES.get('profile_image')
        
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
            user = CustomUser.objects.create(
                username=employee_no,
                employee_no=employee_no,
                full_name=full_name,
                email=email,
                phone=phone,
                whatsapp_number=whatsapp_number,
                active=False # Defaults to inactive / waiting approval
            )
            user.set_password(password)
            if profile_image:
                user.profile_image = profile_image
            user.save()
            
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
                profile_image_url = request.build_absolute_uri(user.profile_image.url)
            except Exception:
                profile_image_url = user.profile_image.url
                
        return Response({
            "token": token.key,
            "permissions": list(user.get_all_permissions()),
            "accessible_stores": [{"store_id": s.store_id, "store_name": s.store_name} for s in user.accessible_stores.all()],
            "store": {"store_id": user.store.store_id, "store_name": user.store.store_name} if user.store else None,
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
                "profile_image": profile_image_url,
                "sub_departments": [sd.sub_department_name for sd in user.sub_departments.all()]
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
                profile_image_url = request.build_absolute_uri(user.profile_image.url)
            except Exception:
                profile_image_url = user.profile_image.url
                
        return Response({
            "permissions": list(user.get_all_permissions()),
            "accessible_stores": [{"store_id": s.store_id, "store_name": s.store_name} for s in user.accessible_stores.all()],
            "store": {"store_id": user.store.store_id, "store_name": user.store.store_name} if user.store else None,
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
                "profile_image": profile_image_url,
                "sub_departments": [sd.sub_department_name for sd in user.sub_departments.all()]
            }
        }, status=status.HTTP_200_OK)

