import io
import logging

from pydantic import ValidationError

from app.errors import field_errors
from app.services.detection.service import detect
from app.services.ingest.parsers.base import MissingColumns, RawRow, UnsupportedFormat
from app.services.ingest.parsers.factory import get_parser
from app.services.ingest.register import apply_registration, parse_registration
from app.services.ingest.registry import Registry, load_registry
from app.services.ingest.repository import ReadingRepository
from app.services.ingest.schemas import FridgeNameMismatch, ReadingIn, RecordIn, SaveResult
from app.services.ingest.unknown import find_unknown

logger = logging.getLogger(__name__)


def ingest_rows(
    session, rows: list[RawRow], register: str | dict | None = None, schema: type[ReadingIn] = ReadingIn
) -> SaveResult:
    """Register confirmed entities, save the valid rows in one transaction, and report the invalid ones.

    Args:
        session: The SQLAlchemy session.
        rows: Parsed rows with their file row numbers.
        register: Optional register block (JSON text or dict); an invalid block raises ValidationError.
        schema: The row model; RecordIn for a record typed in the app.

    Returns:
        Counts of inserted, duplicate, ERR and rejected rows, plus the errors of the rejected rows.
    """
    registration = parse_registration(session, register)
    if registration:
        apply_registration(session, registration)
    registry = load_registry(session)
    result, valid, failed = SaveResult(), [], []
    for raw in rows:
        try:
            valid.append((raw.row, schema.model_validate(raw.values, context={"registry": registry})))
        except ValidationError as exc:
            result.rejected += 1
            result.errors.extend(field_errors(exc, row=raw.row))
            failed.append((raw.values, {e["type"] for e in exc.errors()}))
    result.unknown = find_unknown(failed, registry)
    result.fridge_name_mismatches = _name_mismatches(valid, registry)
    repository = ReadingRepository(session, registry)
    repository.save_many([reading for _, reading in valid], result)
    fridge_ids = {registry.loggers[r.logger_id].fridge_id for r in repository.new_readers}
    result.alerts = detect(session, fridge_ids, {r.id for r in repository.new_readers})
    session.commit()
    logger.info(
        "Ingested %d rows: %d inserted, %d duplicates, %d ERR, %d rejected",
        len(rows), result.inserted, result.duplicates, result.err_rows, result.rejected,
    )
    if result.rejected:
        logger.warning("Rejected rows have errors in fields: %s", sorted({e.field for e in result.errors}))
    if result.fridge_name_mismatches:
        logger.warning("%d saved rows have a fridge name that differs from their fridge", len(result.fridge_name_mismatches))
    return result


def _name_mismatches(valid: list[tuple[int, ReadingIn]], registry: Registry) -> list[FridgeNameMismatch]:
    """Rows whose fridge name is neither the stored name nor the logger's new display name (likely typos)."""
    newest: dict[str, ReadingIn] = {}
    for _, reading in valid:
        if reading.logger not in newest or reading.time > newest[reading.logger].time:
            newest[reading.logger] = reading
    mismatches = []
    for row, reading in valid:
        stored, latest = registry.loggers[reading.logger].fridge, newest[reading.logger].fridge
        if reading.fridge.lower() not in {stored.lower(), latest.lower()}:
            mismatches.append(FridgeNameMismatch(row=row, logger=reading.logger, name_in_file=reading.fridge, fridge=latest))
    return mismatches


def ingest_record(session, values: dict) -> SaveResult:
    """Ingest one reading typed in the app, with an optional "register" key; it becomes row 1."""
    values = dict(values)
    register = values.pop("register", None)
    logger.info("Single record received")
    return ingest_rows(session, [RawRow(1, values)], register, schema=RecordIn)


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
