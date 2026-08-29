import io
import re
import os
import base64
import tempfile
from xhtml2pdf import pisa

html_with_base64 = """
<html>
<body>
<h1>Test Chart</h1>
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
</body>
</html>
"""

print("Testing direct xhtml2pdf with data URI...")
result = io.BytesIO()
try:
    status = pisa.CreatePDF(io.StringIO(html_with_base64), dest=result)
    print("Direct status err:", status.err)
except Exception as e:
    print("Direct failed:", e)

# Helper function to convert data URIs to temporary files for xhtml2pdf
def prepare_html_for_pdf(html_str: str) -> tuple[str, list[str]]:
    temp_files = []
    def replace_data_uri(match):
        mime, b64data = match.group(1), match.group(2)
        ext = '.png' if 'png' in mime else '.jpg'
        data_bytes = base64.b64decode(b64data)
        
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        tmp.write(data_bytes)
        tmp.close()
        temp_files.append(tmp.name)
        return f'src="{tmp.name}"'

    # Match src="data:image/png;base64,..." or src='data:...'
    cleaned_html = re.sub(
        r'src=["\']data:(image/[^;]+);base64,([^"\']+)["\']',
        replace_data_uri,
        html_str
    )
    return cleaned_html, temp_files

print("\nTesting cleaned HTML with temp files...")
cleaned, tmp_paths = prepare_html_for_pdf(html_with_base64)
result2 = io.BytesIO()
try:
    status2 = pisa.CreatePDF(io.StringIO(cleaned), dest=result2)
    print("Cleaned status err:", status2.err, "PDF size:", len(result2.getvalue()))
finally:
    for p in tmp_paths:
        try:
            os.remove(p)
        except Exception:
            pass
