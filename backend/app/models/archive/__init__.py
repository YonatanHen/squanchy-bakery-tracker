"""Archive tables: readings and alerts moved here instead of being deleted."""

from app.models.archive.alert_archive import AlertArchive
from app.models.archive.reader_archive import ReaderArchive

__all__ = ["AlertArchive", "ReaderArchive"]
