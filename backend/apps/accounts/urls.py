from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, CustomUserViewSet, SignupView, LoginView, ProfileView, ForgotPasswordView, ResetPasswordView

router = DefaultRouter()
router.register(r'role', RoleViewSet)
router.register(r'customuser', CustomUserViewSet)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('', include(router.urls)),
]

