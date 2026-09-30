import csv
import io
import logging
from typing import BinaryIO

from app.services.ingest.parsers.base import REQUIRED_COLUMNS, RawRow, map_columns

logger = logging.getLogger(__name__)


class CsvParser:
    """Reads .csv logger exports; columns are matched by header name, in any order and case."""

    def parse(self, stream: BinaryIO) -> list[RawRow]:
        """Read every data row of the CSV file; the delimiter (',' or ';') is detected from the header."""
        text = stream.read().decode("utf-8-sig")  # drops Excel's BOM
        header_line = text.split("\n", 1)[0]
        delimiter = ";" if header_line.count(";") > header_line.count(",") else ","
        rows = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter)
        columns = map_columns(next(rows, []))
        result = [
            RawRow(number, {c: values[columns[c]] for c in REQUIRED_COLUMNS})
            for number, values in enumerate(rows, start=2)
        ]
        logger.info("Parsed CSV file: %d data rows", len(result))
        return result
