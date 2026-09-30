import io

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
