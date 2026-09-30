import logging

from sqlalchemy import Select, case, delete, func, select

from app.models import Alert, Branch, Fridge, Logger, Metric, Reader, Status
from app.models.archive import AlertArchive, ReaderArchive
from app.schemas.reading import LocationFilters, ReadingFilters, ReadingOut, ReadingPage, ReadingPatch
from app.services.detection.service import detect
from app.services.errors import ConflictError, get_or_raise
from app.services.units import to_celsius

logger = logging.getLogger(__name__)

TEXT_COLUMNS = {
    "branch": Branch.name, "city": Branch.city, "street": Branch.street,
    "building_number": Branch.building_number, "fridge": Fridge.name, "logger_id": Logger.id,
}
TEMP_C = case((Reader.metric == Metric.F, (Reader.temp - 32) * 5 / 9), else_=Reader.temp)


def apply_location_filters(stmt: Select, f: LocationFilters) -> Select:
    """Apply the shared location and date filters; stmt must join Reader, Logger, Fridge and Branch."""
    for name, column in TEXT_COLUMNS.items():
        value = getattr(f, name)
        if value:
            stmt = stmt.where(func.lower(column) == value.lower())
    if f.date_from:
        stmt = stmt.where(Reader.time >= f.date_from)
    if f.date_to:
        stmt = stmt.where(Reader.time <= f.date_to)
    return stmt


def query_readings(session, f: ReadingFilters) -> tuple[list[tuple[Reader, Fridge, Branch]], int]:
    """Filter readings; the temperature range is compared in °C, so °F fridges match correctly.

    Args:
        session: The SQLAlchemy session.
        f: Validated filters.

    Returns:
        The page of (reading, fridge, branch) rows in time order, and the total number of matches.
    """
    stmt = (
        select(Reader, Fridge, Branch)
        .join(Logger, Reader.logger_id == Logger.id)
        .join(Fridge, Logger.fridge_id == Fridge.id)
        .join(Branch, Fridge.branch_id == Branch.id)
    )
    stmt = apply_location_filters(stmt, f)
    if f.temp_min is not None:
        stmt = stmt.where(TEMP_C >= to_celsius(f.temp_min, f.unit))
    if f.temp_max is not None:
        stmt = stmt.where(TEMP_C <= to_celsius(f.temp_max, f.unit))
    if f.status:
        stmt = stmt.where(Reader.status == f.status)
    if f.metric:
        stmt = stmt.where(Reader.metric == f.metric)
    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = session.execute(stmt.order_by(Reader.time, Reader.id).offset(f.offset).limit(f.limit)).all()
    logger.info("Readings query matched %d rows", total)
    return [tuple(row) for row in rows], total


def apply_archive_filters(stmt: Select, f: LocationFilters) -> Select:
    """Apply the branch, fridge, logger and date filters to ReaderArchive; city and address are not archived."""
    for name, column in (("branch", ReaderArchive.branch), ("fridge", ReaderArchive.fridge), ("logger_id", ReaderArchive.logger_id)):
        value = getattr(f, name)
        if value:
            stmt = stmt.where(func.lower(column) == value.lower())
    if f.date_from:
        stmt = stmt.where(ReaderArchive.time >= f.date_from)
    if f.date_to:
        stmt = stmt.where(ReaderArchive.time <= f.date_to)
    return stmt


def query_archived_readings(session, f: ReadingFilters) -> tuple[list[ReaderArchive], int]:
    """Filter deleted readings by location and dates.

    Args:
        session: The SQLAlchemy session.
        f: Validated filters; only branch, fridge, logger and dates apply.

    Returns:
        The page of archived readings, newest first, and the total number of matches.
    """
    stmt = apply_archive_filters(select(ReaderArchive), f)
    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = session.scalars(stmt.order_by(ReaderArchive.time.desc(), ReaderArchive.id).offset(f.offset).limit(f.limit)).all()
    logger.info("Archived readings query matched %d rows", total)
    return list(rows), total


def known_logger_ids(session) -> set[str]:
    """Ids of all registered loggers, the validation context of a reading edit."""
    return set(session.scalars(select(Logger.id)))


def _reading_out(reader: Reader, fridge: Fridge, branch: Branch) -> ReadingOut:
    """A reading with the names of its fridge and branch."""
    return ReadingOut(
        id=reader.id, time=reader.time, temp=reader.temp, metric=reader.metric, status=reader.status,
        logger_id=reader.logger_id, fridge=fridge.name, branch=branch.name, city=branch.city,
    )


def _archived_out(reader: ReaderArchive) -> ReadingOut:
    """An archived reading; branch and fridge come from its snapshot."""
    return ReadingOut(
        id=reader.id, time=reader.time, temp=reader.temp, metric=reader.metric, status=reader.status,
        logger_id=reader.logger_id, fridge=reader.fridge, branch=reader.branch, city=None, archived_at=reader.archived_at,
    )


def list_readings(session, f: ReadingFilters) -> ReadingPage:
    """One page of active readings, or of deleted ones when f.archived is set."""
    if f.archived:
        archived, total = query_archived_readings(session, f)
        items = [_archived_out(row) for row in archived]
    else:
        rows, total = query_readings(session, f)
        items = [_reading_out(*row) for row in rows]
    return ReadingPage(items=items, total=total, offset=f.offset, limit=f.limit)


def edit_reading(session, reading_id: int, body: dict) -> ReadingOut:
    """Validate the fields sent (the logger must be registered) and correct the reading; ValidationError -> 422."""
    patch = ReadingPatch.model_validate(body, context={"loggers": known_logger_ids(session)})
    reader = update_reading(session, reading_id, patch.model_dump(exclude_unset=True))
    fridge = reader.logger.fridge
    return _reading_out(reader, fridge, fridge.branch)


def update_reading(session, reading_id: int, changes: dict) -> Reader:
    """Correct a reading in place (a new logger moves it), re-detect both fridges (old alerts removed); a clashing time -> 409."""
    reader = get_or_raise(session, Reader, reading_id)
    old_fridge_id = reader.logger.fridge_id
    if "logger_id" in changes:
        reader.logger = session.get(Logger, changes["logger_id"])
        reader.metric = reader.logger.fridge.metric  # value unchanged, relabeled in the new fridge's unit
    if "time" in changes:
        reader.time = changes["time"]
    if "temp" in changes:
        reader.temp = changes["temp"]
        reader.status = Status.ERR if reader.temp is None else Status.OK
    session.flush()
    session.execute(delete(Alert).where(Alert.reader_id == reader.id).execution_options(synchronize_session=False))
    detect(session, {old_fridge_id, reader.logger.fridge_id}, {reader.id})
    session.commit()
    logger.info("Updated reading id=%s fields=%s", reading_id, sorted(changes))
    return reader


def restore_reading(session, reading_id: int) -> ReadingOut:
    """Move an archived reading back to its logger in the fridge's current unit, drop its archived alerts and re-detect."""
    archived = get_or_raise(session, ReaderArchive, reading_id)
    reading_logger = session.get(Logger, archived.logger_id)
    if reading_logger is None:
        raise ConflictError(f"Logger {archived.logger_id} no longer exists, so this reading cannot be restored")
    if session.scalar(select(Reader.id).where(Reader.logger_id == archived.logger_id, Reader.time == archived.time)):
        raise ConflictError(f"Logger {archived.logger_id} already has a reading at {archived.time:%Y-%m-%d %H:%M}")
    fridge = reading_logger.fridge
    reader = Reader(
        id=archived.id, logger=reading_logger, time=archived.time, temp=archived.temp,
        status=archived.status, metric=fridge.metric,
    )
    session.add(reader)
    session.execute(delete(AlertArchive).where(AlertArchive.reader_id == reading_id).execution_options(synchronize_session=False))
    session.delete(archived)
    session.flush()
    detect(session, {fridge.id}, {reader.id})
    session.commit()
    logger.info("Restored reading id=%s to logger %s", reading_id, reader.logger_id)
    return _reading_out(reader, fridge, fridge.branch)


def delete_reading(session, reading_id: int) -> None:
    """Delete a reading (it is archived with its alerts) and rebuild its fridge's limit periods."""
    reader = get_or_raise(session, Reader, reading_id)
    fridge_id = reader.logger.fridge_id
    session.delete(reader)
    session.flush()
    detect(session, {fridge_id}, set())
    session.commit()
    logger.info("Deleted reading id=%s", reading_id)
