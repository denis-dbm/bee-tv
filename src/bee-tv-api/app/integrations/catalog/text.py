"""Plain-text helpers for partner content that arrives as HTML."""

import re
from html import unescape
from html.parser import HTMLParser

_WHITESPACE = re.compile(r"\s+")


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def html_to_text(value: str | None) -> str:
    """Strip markup so the frontend never has to render partner HTML (XSS-safe)."""
    if not value:
        return ""
    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    return _WHITESPACE.sub(" ", unescape("".join(parser.parts))).strip()
