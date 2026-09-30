import io
import logging

from pydantic import ValidationError

from app.errors import field_errors
from app.services.ingest.parsers.base import MissingColumns, RawRow, UnsupportedFormat
from app.services.ingest.parsers.factory import get_parser
from app.services.ingest.registry import load_registry
from app.services.ingest.repository import ReadingRepository
from app.services.ingest.schemas import ReadingIn, SaveResult

logger = logging.getLogger(__name__)


def ingest_rows(session, rows: list[RawRow]) -> SaveResult:
    """Save the valid rows in one transaction and report the invalid ones for the user to fix.

    Args:
        session: The SQLAlchemy session.
        rows: Parsed rows with their file row numbers.

    Returns:
        Counts of inserted, duplicate, ERR and rejected rows, plus the errors of the rejected rows.
    """
    registry = load_registry(session)
    result, readings = SaveResult(), []
    for raw in rows:
        try:
            readings.append(ReadingIn.model_validate(raw.values, context={"registry": registry}))
        except ValidationError as exc:
            result.rejected += 1
            result.errors.extend(field_errors(exc, row=raw.row))
    ReadingRepository(session, registry).save_many(readings, result)
    session.commit()
    logger.info(
        "Ingested %d rows: %d inserted, %d duplicates, %d ERR, %d rejected",
        len(rows), result.inserted, result.duplicates, result.err_rows, result.rejected,
    )
    if result.rejected:
        logger.warning("Rejected rows have errors in fields: %s", sorted({e.field for e in result.errors}))
    return result


def ingest_file(session, filename: str, content: bytes) -> SaveResult:
    """Parse an uploaded file and ingest its rows; raises UnsupportedFormat or MissingColumns."""
    logger.info("Upload received: %s (%d bytes)", filename, len(content))
    try:
        rows = get_parser(filename, content[:8]).parse(io.BytesIO(content))
    except UnsupportedFormat:
        logger.warning("Rejected upload: unsupported file format")
        raise
    except MissingColumns as exc:
        logger.warning("Rejected upload: missing columns %s", exc.missing)
        raise
    return ingest_rows(session, rows)
