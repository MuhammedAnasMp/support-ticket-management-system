"""
Report Definition Models

Stores report configurations and generation logs.
"""

from django.db import models
from django.conf import settings


class ReportDefinition(models.Model):
    """Stores a saved report configuration as JSON metadata."""

    ORIENTATION_CHOICES = [
        ('portrait', 'Portrait'),
        ('landscape', 'Landscape'),
    ]

    PAGE_SIZE_CHOICES = [
        ('A4', 'A4'),
        ('A3', 'A3'),
        ('Letter', 'Letter'),
    ]

    THEME_CHOICES = [
        ('corporate_blue', 'Corporate Blue'),
        ('maintenance', 'Maintenance'),
        ('finance', 'Finance'),
        ('minimal', 'Minimal'),
        ('executive', 'Executive'),
    ]

    report_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, help_text='Report title')
    description = models.TextField(blank=True, default='', help_text='Report description')
    data_source = models.CharField(
        max_length=100,
        help_text='Registry key, e.g. maintenance.ticket',
    )
    definition = models.JSONField(
        default=dict,
        help_text='Full report config: columns, filters, sorting, grouping, aggregations, formatting, layout',
    )
    theme = models.CharField(
        max_length=30, choices=THEME_CHOICES, default='corporate_blue',
        help_text='Visual theme for rendered output',
    )
    page_orientation = models.CharField(
        max_length=15, choices=ORIENTATION_CHOICES, default='portrait',
    )
    page_size = models.CharField(
        max_length=10, choices=PAGE_SIZE_CHOICES, default='A4',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_reports',
    )
    created_date = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='updated_reports',
    )
    updated_date = models.DateTimeField(auto_now=True)
    is_public = models.BooleanField(
        default=False,
        help_text='If True, all authorized users can access this report',
    )
    shared_roles = models.JSONField(
        null=True, blank=True, default=None,
        help_text='List of role names that can access this report',
    )
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['-updated_date']
        verbose_name = 'Report Definition'
        verbose_name_plural = 'Report Definitions'

    def __str__(self):
        return f"{self.name} ({self.data_source})"


class ReportGenerationLog(models.Model):
    """Audit log for each report execution."""

    FORMAT_CHOICES = [
        ('preview', 'Preview'),
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('csv', 'CSV'),
    ]

    log_id = models.AutoField(primary_key=True)
    report = models.ForeignKey(
        ReportDefinition,
        on_delete=models.CASCADE,
        related_name='generation_logs',
        null=True, blank=True,
        help_text='NULL for ad-hoc (unsaved) report runs',
    )
    report_name = models.CharField(
        max_length=255, default='Ad-hoc Report',
        help_text='Snapshot of report name at generation time',
    )
    data_source = models.CharField(max_length=100, default='')
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='report_logs',
    )
    generated_date = models.DateTimeField(auto_now_add=True)
    export_format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    filters_used = models.JSONField(
        default=dict,
        help_text='Snapshot of runtime filters applied',
    )
    definition_snapshot = models.JSONField(
        default=dict,
        help_text='Snapshot of the full report definition used',
    )
    row_count = models.PositiveIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-generated_date']
        verbose_name = 'Report Generation Log'
        verbose_name_plural = 'Report Generation Logs'

    def __str__(self):
        return f"{self.report_name} - {self.export_format} ({self.generated_date})"


class ReportSchedule(models.Model):
    """Configuration for automated recurring report generation and email delivery."""

    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    schedule_id = models.AutoField(primary_key=True)
    report = models.ForeignKey(
        ReportDefinition,
        on_delete=models.CASCADE,
        related_name='schedules',
    )
    frequency = models.CharField(max_length=15, choices=FREQUENCY_CHOICES, default='weekly')
    recipient_emails = models.JSONField(
        default=list,
        help_text='List of email addresses to send generated report to',
    )
    export_format = models.CharField(max_length=10, choices=[('pdf', 'PDF'), ('excel', 'Excel')], default='pdf')
    is_active = models.BooleanField(default=True)
    last_run = models.DateTimeField(null=True, blank=True)
    next_run = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-next_run']
        verbose_name = 'Report Schedule'
        verbose_name_plural = 'Report Schedules'

    def __str__(self):
        return f"Schedule for {self.report.name} ({self.frequency})"

