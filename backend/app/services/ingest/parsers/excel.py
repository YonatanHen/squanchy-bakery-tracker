import logging
from typing import BinaryIO

from openpyxl import load_workbook

from app.services.ingest.parsers.base import REQUIRED_COLUMNS, RawRow, map_columns

logger = logging.getLogger(__name__)

XLSX_MAGIC = b"PK\x03\x04"  # .xlsx is a ZIP archive


class ExcelParser:
    """Reads .xlsx logger exports; columns are matched by header name, in any order and case."""

    def can_parse(self, filename: str, head: bytes) -> bool:
        """Return True for a .xlsx name whose content is really a ZIP (xlsx) file."""
        return filename.lower().endswith(".xlsx") and head.startswith(XLSX_MAGIC)

    def parse(self, stream: BinaryIO) -> list[RawRow]:
        """Read the first sheet's data rows; raises MissingColumns if a required header is absent."""
        workbook = load_workbook(stream, read_only=True, data_only=True)
        try:
            rows = workbook.active.iter_rows(values_only=True)
            columns = map_columns(next(rows, None) or ())
            result = []
            for number, values in enumerate(rows, start=2):
                if all(v is None for v in values):
                    continue
                result.append(
                    RawRow(number, {c: values[columns[c]] if columns[c] < len(values) else None for c in REQUIRED_COLUMNS})
                )
        finally:
            workbook.close()
        logger.info("Parsed Excel file: %d data rows", len(result))
        return result
