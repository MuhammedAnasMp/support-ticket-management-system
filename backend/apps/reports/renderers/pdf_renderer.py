"""
PDF Renderer — Converts HTML report to PDF using xhtml2pdf.

xhtml2pdf is used instead of WeasyPrint because it's pure Python
and doesn't require system-level dependencies (pango, cairo).
"""

import io

from .html_renderer import HtmlRenderer
from .base import BaseRenderer


class PdfRenderer(BaseRenderer):
    """Render report as PDF file."""

    @property
    def content_type(self):
        return 'application/pdf'

    @property
    def file_extension(self):
        return 'pdf'

    def render(self) -> bytes:
        # First render as HTML using HtmlRenderer
        html_renderer = HtmlRenderer(
            report_data=self.report_data,
            definition=self.definition,
            metadata=self.metadata,
        )
        html_content = html_renderer.render()

        try:
            from xhtml2pdf import pisa

            result = io.BytesIO()
            pisa_status = pisa.CreatePDF(
                src=html_content,
                dest=result,
                encoding='UTF-8',
            )

            if pisa_status.err:
                raise RuntimeError(f"PDF generation error: {pisa_status.err}")

            return result.getvalue()

        except ImportError:
            # Fallback: return HTML as bytes if xhtml2pdf not installed
            return html_content.encode('utf-8')
