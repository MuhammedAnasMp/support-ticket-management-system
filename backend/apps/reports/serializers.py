"""
Serializers for Reports app.
"""

from rest_framework import serializers
from .models import ReportDefinition, ReportGenerationLog, ReportSchedule


class ReportDefinitionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.full_name')

    class Meta:
        model = ReportDefinition
        fields = [
            'report_id',
            'name',
            'description',
            'data_source',
            'definition',
            'theme',
            'page_orientation',
            'page_size',
            'created_by',
            'created_by_name',
            'created_date',
            'updated_by',
            'updated_date',
            'is_public',
            'shared_roles',
            'version',
        ]
        read_only_fields = ['report_id', 'created_by', 'created_date', 'updated_by', 'updated_date', 'version']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        validated_data['version'] = instance.version + 1
        return super().update(instance, validated_data)


class ReportGenerationLogSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.ReadOnlyField(source='generated_by.full_name')

    class Meta:
        model = ReportGenerationLog
        fields = [
            'log_id',
            'report',
            'report_name',
            'data_source',
            'generated_by',
            'generated_by_name',
            'generated_date',
            'export_format',
            'filters_used',
            'row_count',
            'duration_ms',
        ]
        read_only_fields = fields


class ReportExecuteRequestSerializer(serializers.Serializer):
    data_source = serializers.CharField(max_length=100)
    definition = serializers.JSONField()
    runtime_filters = serializers.JSONField(required=False, default=dict)
    format = serializers.ChoiceField(choices=['preview', 'pdf', 'excel', 'csv'], default='preview')


class ReportScheduleSerializer(serializers.ModelSerializer):
    report_name = serializers.ReadOnlyField(source='report.name')

    class Meta:
        model = ReportSchedule
        fields = [
            'schedule_id',
            'report',
            'report_name',
            'frequency',
            'recipient_emails',
            'export_format',
            'is_active',
            'last_run',
            'next_run',
        ]

