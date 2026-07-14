from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PriorityViewSet, StatusViewSet, MaintenanceNatureViewSet,
    NatureWorkerViewSet, TicketViewSet, AllocationViewSet,
    WorkLogViewSet, TicketHistoryViewSet
)

router = DefaultRouter()
router.register(r'priority', PriorityViewSet)
router.register(r'status', StatusViewSet)
router.register(r'maintenancenature', MaintenanceNatureViewSet)
router.register(r'natureworker', NatureWorkerViewSet)
router.register(r'ticket', TicketViewSet)
router.register(r'allocation', AllocationViewSet)
router.register(r'worklog', WorkLogViewSet)
router.register(r'tickethistory', TicketHistoryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
