import csv
import io
import logging
from typing import BinaryIO

from app.services.ingest.normalizer import collapse_spaces
from app.services.ingest.parsers.base import REQUIRED_COLUMNS, RawRow

logger = logging.getLogger(__name__)


class CsvParser:
    """Reads .csv logger exports; columns are matched by header name, in any order and case."""

    def parse(self, stream: BinaryIO) -> list[RawRow]:
        """Read every data row of the CSV file."""
        rows = csv.reader(io.TextIOWrapper(stream, encoding="utf-8", newline=""))
        header = next(rows, [])
        columns = {collapse_spaces(h).lower(): i for i, h in enumerate(header)}
        result = [
            RawRow(number, {c: values[columns[c]] for c in REQUIRED_COLUMNS})
            for number, values in enumerate(rows, start=2)
        ]
        logger.info("Parsed CSV file: %d data rows", len(result))
        return result
