import io
import logging

from pydantic import ValidationError

from app.errors import field_errors
from app.services.detection.service import detect
from app.services.ingest.parsers.base import MissingColumns, RawRow, UnsupportedFormat
from app.services.ingest.parsers.factory import get_parser
from app.services.ingest.register import apply_registration, parse_registration
from app.services.ingest.registry import load_registry
from app.services.ingest.repository import ReadingRepository
from app.services.ingest.schemas import ReadingIn, SaveResult
from app.services.ingest.unknown import find_unknown

logger = logging.getLogger(__name__)


def ingest_rows(session, rows: list[RawRow], register: str | dict | None = None) -> SaveResult:
    """Register confirmed entities, save the valid rows in one transaction, and report the invalid ones.

    Args:
        session: The SQLAlchemy session.
        rows: Parsed rows with their file row numbers.
        register: Optional register block (JSON text or dict); an invalid block raises ValidationError.

    Returns:
        Counts of inserted, duplicate, ERR and rejected rows, plus the errors of the rejected rows.
    """
    registration = parse_registration(session, register)
    if registration:
        apply_registration(session, registration)
    registry = load_registry(session)
    result, readings, failed = SaveResult(), [], []
    for raw in rows:
        try:
            readings.append(ReadingIn.model_validate(raw.values, context={"registry": registry}))
        except ValidationError as exc:
            result.rejected += 1
            result.errors.extend(field_errors(exc, row=raw.row))
            failed.append((raw.values, {e["type"] for e in exc.errors()}))
    result.unknown = find_unknown(failed, registry)
    repository = ReadingRepository(session, registry)
    repository.save_many(readings, result)
    fridge_ids = {registry.loggers[r.logger_id].fridge_id for r in repository.new_readers}
    result.alerts = detect(session, fridge_ids, {r.id for r in repository.new_readers})
    session.commit()
    logger.info(
        "Ingested %d rows: %d inserted, %d duplicates, %d ERR, %d rejected",
        len(rows), result.inserted, result.duplicates, result.err_rows, result.rejected,
    )
    if result.rejected:
        logger.warning("Rejected rows have errors in fields: %s", sorted({e.field for e in result.errors}))
    return result


def ingest_record(session, values: dict) -> SaveResult:
    """Ingest one reading typed in the app, with an optional "register" key; it becomes row 1."""
    values = dict(values)
    register = values.pop("register", None)
    logger.info("Single record received")
    return ingest_rows(session, [RawRow(1, values)], register)


def ingest_file(session, filename: str, content: bytes, register: str | None = None) -> SaveResult:
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
    return ingest_rows(session, rows, register)
