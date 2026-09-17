from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExpenseTypeViewSet, EmployeeRateViewSet, ExpenseViewSet, ReconciliationViewSet, WorkerClaimViewSet

router = DefaultRouter()
router.register(r'expensetype', ExpenseTypeViewSet)
router.register(r'employeerate', EmployeeRateViewSet)
router.register(r'expense', ExpenseViewSet)
router.register(r'claim', WorkerClaimViewSet)
router.register(r'reconciliation', ReconciliationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

