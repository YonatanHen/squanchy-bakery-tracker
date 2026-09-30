import io

import pytest

from app.services.ingest.parsers.base import MissingColumns, UnsupportedFormat
from app.services.ingest.parsers.excel import ExcelParser
from app.services.ingest.parsers.factory import get_parser
from tests.helpers import xlsx_bytes


def test_columns_are_mapped_by_header_name_not_position():
    """Columns in a different order are still read into the right fields."""
    content = xlsx_bytes(["Temp", "Time", "Fridge", "Branch", "Logger"], [[3.8, "2026-09-14 06:00", "Dairy", "Jerusalem", "TL-0512"]])

    [row] = ExcelParser().parse(io.BytesIO(content))

    assert row.row == 2
    assert row.values == {"logger": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy", "time": "2026-09-14 06:00", "temp": 3.8}


def test_missing_columns_are_reported():
    """A header without Logger, Branch and Fridge is rejected with those names."""
    content = xlsx_bytes(["Time", "Temp"], [["2026-09-14 06:00", 3.8]])

    with pytest.raises(MissingColumns) as exc:
        ExcelParser().parse(io.BytesIO(content))

    assert exc.value.missing == ["logger", "branch", "fridge"]


def test_trailing_empty_rows_are_ignored():
    """Fully empty rows at the end of the sheet are not readings."""
    content = xlsx_bytes(["Logger", "Branch", "Fridge", "Time", "Temp"], [["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8], [None] * 5])

    assert len(ExcelParser().parse(io.BytesIO(content))) == 1


def test_factory_picks_excel_by_content_and_rejects_a_renamed_csv():
    """The file content decides, not only the extension: a CSV renamed to .xlsx is rejected."""
    content = xlsx_bytes(["Logger"], [])

    assert isinstance(get_parser("week.xlsx", content[:8]), ExcelParser)
    with pytest.raises(UnsupportedFormat):
        get_parser("week.xlsx", b"Logger,Br")
