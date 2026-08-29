"""
URL routing for Reports App.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'definitions', views.ReportDefinitionViewSet, basename='report-definition')
router.register(r'schedules', views.ReportScheduleViewSet, basename='report-schedule')

urlpatterns = [
    path('', include(router.urls)),
    path('sources/', views.list_data_sources, name='report-sources-list'),
    path('sources/<str:key>/fields/', views.get_source_fields, name='report-source-fields'),
    path('preview/', views.preview_report, name='report-preview'),
    path('export/', views.export_report, name='report-export'),
    path('logs/', views.generation_logs, name='report-logs'),
    path('templates/', views.list_templates, name='report-templates'),
]
