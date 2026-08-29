"""
CSV Renderer — Generates CSV output for data export.
"""

import csv
import io

from .base import BaseRenderer


class CsvRenderer(BaseRenderer):
    """Render report as CSV file."""

    @property
    def content_type(self):
        return 'text/csv'

    @property
    def file_extension(self):
        return 'csv'

    def render(self) -> bytes:
        columns = self.get_columns()
        rows = self.get_rows()

        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Header row
        writer.writerow([col.get('label', col['path']) for col in columns])

        # Data rows
        for row_data in rows:
            writer.writerow([
                self.format_value(row_data.get(col['path']), col)
                for col in columns
            ])

        # Aggregation totals row
        aggregations = self.get_aggregations()
        if aggregations:
            total_cells = []
            for i, col in enumerate(columns):
                if i == 0:
                    total_cells.append('TOTALS')
                else:
                    alias = col['path'].lower().replace(' ', '_').replace('-', '_')
                    val = aggregations.get(alias)
                    total_cells.append(self.format_value(val, col) if val is not None else '')
            writer.writerow(total_cells)

        # Use UTF-8 BOM for Excel compatibility with special characters
        return ('\ufeff' + output.getvalue()).encode('utf-8')
