from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, BinaryIO, Protocol

from app.services.ingest.normalizer import collapse_spaces

REQUIRED_COLUMNS = ("logger", "branch", "fridge", "time", "temp")


@dataclass(frozen=True)
class RawRow:
    """One data row of an uploaded file; row is the 1-based row number in the file."""

    row: int
    values: dict[str, Any]


class ReadingParser(Protocol):
    """A file format the upload accepts (Strategy); register implementations in factory.PARSERS."""

    def can_parse(self, filename: str, head: bytes) -> bool:
        """Return True if this parser reads files with this name and first bytes."""
        ...

    def parse(self, stream: BinaryIO) -> list[RawRow]:
        """Read every non-empty data row, keyed by REQUIRED_COLUMNS."""
        ...


class UnsupportedFormat(Exception):
    """No parser accepts the uploaded file."""


class UnreadableFile(Exception):
    """A parser accepts the file type but cannot read its content, e.g. a CSV that is not UTF-8."""


class MissingColumns(Exception):
    """The file's header lacks required columns."""

    def __init__(self, missing: list[str]):
        """Keep the missing column names for the error response."""
        super().__init__(f"Missing columns: {', '.join(missing)}")
        self.missing = missing


def map_columns(header: Sequence[Any]) -> dict[str, int]:
    """Map each header name (spaces collapsed, lower case) to its index; raises MissingColumns."""
    columns = {collapse_spaces(h).lower(): i for i, h in enumerate(header) if h is not None}
    missing = [c for c in REQUIRED_COLUMNS if c not in columns]
    if missing:
        raise MissingColumns(missing)
    return columns
