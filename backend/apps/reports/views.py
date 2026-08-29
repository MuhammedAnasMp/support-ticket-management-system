"""
Views for Reports App.
"""

from django.http import HttpResponse
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response

from .models import ReportDefinition, ReportGenerationLog, ReportSchedule
from .serializers import (
    ReportDefinitionSerializer,
    ReportGenerationLogSerializer,
    ReportExecuteRequestSerializer,
    ReportScheduleSerializer,
)
from .registry import registry
from .query_engine import execute_report
from .renderers.html_renderer import HtmlRenderer
from .renderers.pdf_renderer import PdfRenderer
from .renderers.excel_renderer import ExcelRenderer
from .renderers.csv_renderer import CsvRenderer


class ReportScheduleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing automated report schedules."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReportScheduleSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return ReportSchedule.objects.all()
        return ReportSchedule.objects.filter(report__created_by=user)


class ReportDefinitionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing saved report definitions."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReportDefinitionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return ReportDefinition.objects.all()

        role_name = user.role.role_name if user.role else ''
        return ReportDefinition.objects.filter(
            created_by=user
        ) | ReportDefinition.objects.filter(
            is_public=True
        ) | ReportDefinition.objects.filter(
            shared_roles__contains=[role_name]
        ).distinct()

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        report = self.get_object()
        new_report = ReportDefinition.objects.create(
            name=f"{report.name} (Copy)",
            description=report.description,
            data_source=report.data_source,
            definition=report.definition,
            theme=report.theme,
            page_orientation=report.page_orientation,
            page_size=report.page_size,
            created_by=request.user,
            is_public=False,
        )
        serializer = self.get_serializer(new_report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_data_sources(request):
    """List all registered reportable data sources."""
    sources = registry.list_sources()
    return Response(sources)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_source_fields(request, key):
    """Get hierarchical field tree for a data source."""
    rm = registry.get(key)
    if not rm:
        return Response({'detail': f'Data source {key} not found.'}, status=status.HTTP_404_NOT_FOUND)

    fields = registry.get_field_tree(key)
    return Response({
        'key': key,
        'label': rm.label,
        'description': rm.description,
        'fields': fields,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def preview_report(request):
    """Execute report definition and return preview data (JSON)."""
    serializer = ReportExecuteRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    try:
        res = execute_report(
            data_source=data['data_source'],
            definition=data['definition'],
            user=request.user,
            runtime_filters=data.get('runtime_filters'),
            export_format='preview',
        )

        # Log preview execution
        ReportGenerationLog.objects.create(
            report_name=data['definition'].get('name', 'Ad-hoc Preview'),
            data_source=data['data_source'],
            generated_by=request.user,
            export_format='preview',
            filters_used=data.get('runtime_filters', {}),
            definition_snapshot=data['definition'],
            row_count=res['row_count'],
            duration_ms=res['duration_ms'],
        )

        return Response(res)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def export_report(request):
    """Export report to PDF, Excel, or CSV."""
    serializer = ReportExecuteRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    export_format = data.get('format', 'pdf').lower()

    try:
        report_data = execute_report(
            data_source=data['data_source'],
            definition=data['definition'],
            user=request.user,
            runtime_filters=data.get('runtime_filters'),
            export_format=export_format,
        )

        metadata = {
            'name': data['definition'].get('name', 'Report'),
            'description': data['definition'].get('description', ''),
            'theme': data['definition'].get('theme', 'corporate_blue'),
            'page_orientation': data['definition'].get('page_orientation', 'portrait'),
            'page_size': data['definition'].get('page_size', 'A4'),
        }

        # Select renderer
        if export_format == 'pdf':
            renderer = PdfRenderer(report_data, data['definition'], metadata)
        elif export_format == 'excel':
            renderer = ExcelRenderer(report_data, data['definition'], metadata)
        elif export_format == 'csv':
            renderer = CsvRenderer(report_data, data['definition'], metadata)
        else:
            renderer = HtmlRenderer(report_data, data['definition'], metadata)

        output = renderer.render()
        filename = f"{metadata['name'].lower().replace(' ', '_')}.{renderer.file_extension}"

        # Audit Log
        ReportGenerationLog.objects.create(
            report_name=metadata['name'],
            data_source=data['data_source'],
            generated_by=request.user,
            export_format=export_format,
            filters_used=data.get('runtime_filters', {}),
            definition_snapshot=data['definition'],
            row_count=report_data['row_count'],
            duration_ms=report_data['duration_ms'],
        )

        response = HttpResponse(output, content_type=renderer.content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def generation_logs(request):
    """List generation logs for audit/history."""
    logs = ReportGenerationLog.objects.all()[:100]
    serializer = ReportGenerationLogSerializer(logs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_templates(request):
    """List pre-built report templates."""
    from .templates_registry import get_prebuilt_templates
    return Response(get_prebuilt_templates())

