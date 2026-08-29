"""
PDF Renderer — Converts HTML report to PDF using xhtml2pdf with local resource resolution.
"""

import io
import os
import re
import base64
import tempfile
from django.conf import settings

from .html_renderer import HtmlRenderer
from .base import BaseRenderer


def link_callback(uri, rel):
    """
    Convert HTML URIs (including base64 data URIs and static/media files)
    to absolute system paths so xhtml2pdf accesses them instantaneously without network timeouts.
    """
    if uri.startswith('data:image'):
        try:
            mime_part, data_part = uri.split(';base64,', 1)
            ext = '.png' if 'png' in mime_part else '.jpg'
            image_data = base64.b64decode(data_part)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            tmp.write(image_data)
            tmp.close()
            return tmp.name
        except Exception:
            return uri

    if uri.startswith('http://') or uri.startswith('https://'):
        return uri

    if settings.MEDIA_URL and uri.startswith(settings.MEDIA_URL):
        path = os.path.join(settings.MEDIA_ROOT, uri.replace(settings.MEDIA_URL, ""))
    elif settings.STATIC_URL and uri.startswith(settings.STATIC_URL):
        path = os.path.join(settings.STATIC_ROOT, uri.replace(settings.STATIC_URL, ""))
    else:
        path = uri

    return path if os.path.exists(path) else uri


class PdfRenderer(BaseRenderer):
    """Render report as PDF file."""

    @property
    def content_type(self):
        return 'application/pdf'

    @property
    def file_extension(self):
        return 'pdf'

    def render(self) -> bytes:
        html_renderer = HtmlRenderer(
            report_data=self.report_data,
            definition=self.definition,
            metadata=self.metadata,
        )
        html_content = html_renderer.render()

        # Extract base64 image data URIs and replace with temporary file paths for xhtml2pdf
        temp_files = []
        def _replace_data_uri(match):
            mime_part = match.group(1)
            b64_part = match.group(2)
            ext = '.png' if 'png' in mime_part else '.jpg'
            try:
                img_bytes = base64.b64decode(b64_part)
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
                tmp.write(img_bytes)
                tmp.close()
                temp_files.append(tmp.name)
                # Convert backslashes for xhtml2pdf path compatibility
                clean_path = tmp.name.replace('\\', '/')
                return f'src="{clean_path}"'
            except Exception:
                return match.group(0)

        cleaned_html = re.sub(
            r'src=["\']data:(image/[^;]+);base64,([^"\']+)["\']',
            _replace_data_uri,
            html_content,
        )

        try:
            from xhtml2pdf import pisa

            result = io.BytesIO()
            pisa_status = pisa.CreatePDF(
                src=cleaned_html,
                dest=result,
                encoding='UTF-8',
                link_callback=link_callback,
            )

            if pisa_status.err:
                raise RuntimeError(f"PDF generation error code: {pisa_status.err}")

            return result.getvalue()

        finally:
            # Clean up temporary image files
            for tmp_path in temp_files:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
