"""
QR Code Utility — Generates verification QR codes for report documents.
"""

import io
import base64
import qrcode


def generate_qr_code_image(data_text: str, size: int = 3) -> str | None:
    """
    Generate a QR code image and return it as a base64 PNG data URI.

    Args:
        data_text: Text/URL content for the QR code
        size: Box size

    Returns:
        Base64 string `data:image/png;base64,...` or None
    """
    if not data_text:
        return None

    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=size,
            border=1,
        )
        qr.add_data(data_text)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        base64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{base64_str}"
    except Exception:
        return None
