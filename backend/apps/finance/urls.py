from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExpenseTypeViewSet, EmployeeRateViewSet, ExpenseViewSet,
    WorkerClaimViewSet, ReconciliationViewSet, LedgerGroupViewSet,
    LedgerViewSet, LedgerBatchViewSet, ApprovalWorkflowViewSet, ApprovalStepViewSet,
    ApprovalInstanceViewSet, AuditEventViewSet, PaymentViewSet
)

router = DefaultRouter()
router.register(r'expensetype', ExpenseTypeViewSet)
router.register(r'employeerate', EmployeeRateViewSet)
router.register(r'expense', ExpenseViewSet)
router.register(r'claim', WorkerClaimViewSet)
router.register(r'ledger-batches', LedgerBatchViewSet)
router.register(r'ledger-groups', LedgerGroupViewSet)
router.register(r'ledgers', LedgerViewSet)
router.register(r'workflows', ApprovalWorkflowViewSet)
router.register(r'workflow-steps', ApprovalStepViewSet)
router.register(r'approvals', ApprovalInstanceViewSet)
router.register(r'audit-events', AuditEventViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'reconciliation', ReconciliationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
