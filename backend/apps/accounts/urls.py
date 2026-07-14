from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, CustomUserViewSet, SignupView, LoginView

router = DefaultRouter()
router.register(r'role', RoleViewSet)
router.register(r'customuser', CustomUserViewSet)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('', include(router.urls)),
]
