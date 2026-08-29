"""
Base Renderer — Abstract interface for report output formats.
"""

from abc import ABC, abstractmethod


class BaseRenderer(ABC):
    """Abstract base class for all report renderers."""

    def __init__(self, report_data: dict, definition: dict, metadata: dict | None = None):
        """
        Args:
            report_data: Output from execute_report() — rows, columns, aggregations.
            definition: The report definition JSON.
            metadata: Extra info — report name, theme, page_orientation, etc.
        """
        self.report_data = report_data
        self.definition = definition
        self.metadata = metadata or {}

    @abstractmethod
    def render(self) -> bytes | str:
        """Render the report and return the output."""
        raise NotImplementedError

    @property
    def content_type(self) -> str:
        """MIME type for the rendered output."""
        return 'application/octet-stream'

    @property
    def file_extension(self) -> str:
        """File extension for download."""
        return 'bin'

    def get_title(self) -> str:
        return self.metadata.get('name', 'Report')

    def get_subtitle(self) -> str:
        return self.metadata.get('description', '')

    def get_theme(self) -> str:
        return self.metadata.get('theme', 'corporate_blue')

    def get_orientation(self) -> str:
        return self.metadata.get('page_orientation', 'portrait')

    def get_page_size(self) -> str:
        return self.metadata.get('page_size', 'A4')

    def get_columns(self) -> list[dict]:
        return self.report_data.get('columns', [])

    def get_rows(self) -> list[dict]:
        return self.report_data.get('rows', [])

    def get_aggregations(self) -> dict:
        return self.report_data.get('aggregation_values', {})

    def format_value(self, value, column: dict) -> str:
        """Format a cell value based on column metadata."""
        if value is None:
            return '—'

        col_format = column.get('format')
        col_type = column.get('type', 'text')

        if col_type == 'decimal' and isinstance(value, (int, float)):
            decimals = 2
            if col_format and col_format.startswith('.'):
                try:
                    decimals = int(col_format[1:])
                except (ValueError, IndexError):
                    pass
            return f"{value:,.{decimals}f}"

        if col_type == 'integer' and isinstance(value, (int, float)):
            return f"{int(value):,}"

        if col_type == 'boolean':
            return 'Yes' if value else 'No'

        if col_type in ('date', 'datetime') and isinstance(value, str):
            if 'T' in value:
                return value.split('T')[0] + ' ' + value.split('T')[1][:5]
            return value

        return str(value)
