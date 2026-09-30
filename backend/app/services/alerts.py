import logging

from sqlalchemy import func, select

from app.models import Alert, Branch, Fridge, Logger, Reader
from app.models.archive import AlertArchive, ReaderArchive
from app.schemas.alert import AlertFilters, AlertOut, AlertPage
from app.services.readings import apply_archive_filters, apply_location_filters

logger = logging.getLogger(__name__)


def query_alerts(session, f: AlertFilters) -> tuple[list[tuple], int]:
    """Filter alerts by location, date and level.

    Args:
        session: The SQLAlchemy session.
        f: Validated filters.

    Returns:
        The page of (alert, reading, fridge, branch) rows, newest reading first, and the total number of matches.
    """
    stmt = (
        select(Alert, Reader, Fridge, Branch)
        .join(Reader, Alert.reader_id == Reader.id)
        .join(Logger, Reader.logger_id == Logger.id)
        .join(Fridge, Logger.fridge_id == Fridge.id)
        .join(Branch, Fridge.branch_id == Branch.id)
    )
    stmt = apply_location_filters(stmt, f)
    if f.level:
        stmt = stmt.where(Alert.level == f.level)
    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = session.execute(stmt.order_by(Reader.time.desc(), Alert.id).offset(f.offset).limit(f.limit)).all()
    logger.info("Alerts query matched %d alerts", total)
    return [tuple(row) for row in rows], total


def query_archived_alerts(session, f: AlertFilters) -> tuple[list[tuple], int]:
    """Filter the alerts of deleted readings; only branch, fridge, logger, date and level apply (no city/address).

    Args:
        session: The SQLAlchemy session.
        f: Validated filters.

    Returns:
        The page of (archived alert, archived reading) rows, newest reading first, and the total number of matches.
    """
    stmt = select(AlertArchive, ReaderArchive).join(ReaderArchive, AlertArchive.reader_id == ReaderArchive.id)
    stmt = apply_archive_filters(stmt, f)
    if f.level:
        stmt = stmt.where(AlertArchive.level == f.level)
    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = session.execute(stmt.order_by(ReaderArchive.time.desc(), AlertArchive.id).offset(f.offset).limit(f.limit)).all()
    logger.info("Archived alerts query matched %d alerts", total)
    return [tuple(row) for row in rows], total


def _alert_out(alert: Alert, reader: Reader, fridge: Fridge, branch: Branch) -> AlertOut:
    """An alert with its reading and where it happened."""
    return AlertOut(
        id=alert.id, level=alert.level, description=alert.description, reading_id=reader.id,
        time=reader.time, temp=reader.temp, metric=reader.metric, logger_id=reader.logger_id,
        fridge=fridge.name, branch=branch.name, city=branch.city,
    )


def _archived_out(alert: AlertArchive, reader: ReaderArchive) -> AlertOut:
    """An archived alert; branch and fridge come from the archived reading's snapshot."""
    return AlertOut(
        id=alert.id, level=alert.level, description=alert.description, reading_id=reader.id,
        time=reader.time, temp=reader.temp, metric=reader.metric, logger_id=reader.logger_id,
        fridge=reader.fridge, branch=reader.branch, city=None, archived_at=alert.archived_at,
    )


def list_alerts(session, f: AlertFilters) -> AlertPage:
    """One page of active alerts, or of deleted readings' alerts when f.archived is set."""
    if f.archived:
        archived, total = query_archived_alerts(session, f)
        items = [_archived_out(*row) for row in archived]
    else:
        rows, total = query_alerts(session, f)
        items = [_alert_out(*row) for row in rows]
    return AlertPage(items=items, total=total, offset=f.offset, limit=f.limit)
