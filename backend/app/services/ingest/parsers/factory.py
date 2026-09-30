from app.services.ingest.parsers.base import ReadingParser, UnsupportedFormat
from app.services.ingest.parsers.csv import CsvParser
from app.services.ingest.parsers.excel import ExcelParser

# Register a new format by adding its parser here.
PARSERS: list[ReadingParser] = [ExcelParser(), CsvParser()]


def get_parser(filename: str, head: bytes) -> ReadingParser:
    """Return the first parser that accepts the file; raises UnsupportedFormat otherwise."""
    for parser in PARSERS:
        if parser.can_parse(filename, head):
            return parser
    raise UnsupportedFormat(filename)
