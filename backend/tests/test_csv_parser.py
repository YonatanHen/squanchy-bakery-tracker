import io

import pytest

from app.services.ingest.parsers.base import MissingColumns
from app.services.ingest.parsers.csv import CsvParser


def parse(text: str, encoding: str = "utf-8"):
    """Parse CSV text with CsvParser."""
    return CsvParser().parse(io.BytesIO(text.encode(encoding)))


def test_columns_are_mapped_by_header_name_not_position():
    """Columns in a different order and case are read into the right fields, numbered by file row."""
    rows = parse("TEMP,Time,fridge,Branch,Logger\n3.8,2026-09-14 06:00,Dairy,Jerusalem,TL-0512\nERR,14/09/2026 06:15,Dairy,Jerusalem,TL-0512\n")

    assert [r.row for r in rows] == [2, 3]
    assert rows[0].values == {"logger": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy", "time": "2026-09-14 06:00", "temp": "3.8"}
    assert rows[1].values["temp"] == "ERR"


def test_semicolon_delimited_file_is_read():
    """A CSV saved with ';' as the delimiter (common in European Excel) is read the same way."""
    [row] = parse("Logger;Branch;Fridge;Time;Temp\nTL-0512;Jerusalem;Dairy;14/09/2026 06:00;3.8\n")

    assert row.values == {"logger": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy", "time": "14/09/2026 06:00", "temp": "3.8"}


def test_utf8_bom_before_the_header_is_ignored():
    """Excel's "CSV UTF-8" export starts with a BOM; the first column is still found."""
    [row] = parse("Logger,Branch,Fridge,Time,Temp\nTL-0512,Jerusalem,Dairy,2026-09-14 06:00,3.8\n", encoding="utf-8-sig")

    assert row.values["logger"] == "TL-0512"


def test_missing_columns_are_reported():
    """A header without Logger, Branch and Fridge is rejected with those names."""
    with pytest.raises(MissingColumns) as exc:
        parse("Time,Temp\n2026-09-14 06:00,3.8\n")

    assert exc.value.missing == ["logger", "branch", "fridge"]
