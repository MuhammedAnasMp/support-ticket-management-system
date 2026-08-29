"""
Arabic & RTL Utilities for PDF and HTML Report Rendering.

Provides text reshaping (arabic_reshaper) and bidirectional text handling
(python-bidi) so Arabic characters connect correctly in PDF exports.
"""

import re

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    ARABIC_SUPPORT = True
except ImportError:
    ARABIC_SUPPORT = False

# Regex to detect Arabic Unicode range
ARABIC_RE = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]')


def contains_arabic(text: str) -> bool:
    """Check if text contains Arabic characters."""
    if not text:
        return False
    return bool(ARABIC_RE.search(str(text)))


def prepare_arabic_text(text: str) -> str:
    """
    Reshape and reorder Arabic text for PDF rendering.
    If text contains no Arabic or arabic_reshaper is missing, returns text unchanged.
    """
    if not text or not ARABIC_SUPPORT:
        return text

    text_str = str(text)
    if not contains_arabic(text_str):
        return text_str

    try:
        reshaped = arabic_reshaper.reshape(text_str)
        bidi_text = get_display(reshaped)
        return bidi_text
    except Exception:
        return text_str
