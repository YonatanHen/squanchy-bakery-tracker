import logging

from sqlalchemy import delete, event, insert, select
from sqlalchemy.orm import Session

from app.models import Alert, Branch, Fridge, Logger, Reader
from app.models.archive import AlertArchive, ReaderArchive
from app.schemas.reading import ArchiveCounts

logger = logging.getLogger(__name__)

_NO_SYNC = {"synchronize_session": False}


def _with_location(stmt):
    """Join a Reader select to its logger, fridge and branch."""
    return (
        stmt.select_from(Reader)
        .join(Logger, Reader.logger_id == Logger.id)
        .join(Fridge, Logger.fridge_id == Fridge.id)
        .join(Branch, Fridge.branch_id == Branch.id)
    )


def archive_readings(session, where, delete_readings: bool = True) -> int:
    """Copy the matching readings and their alerts to the archive, then remove them.

    Args:
        session: The SQLAlchemy session.
        where: Filter on Reader, Logger, Fridge or Branch, e.g. `Fridge.id == 3`.
        delete_readings: False when the ORM deletes the readings itself.

    Returns:
        The number of readings archived.
    """
    ids = _with_location(select(Reader.id)).where(where).scalar_subquery()
    rows = _with_location(
        select(Reader.id, Reader.logger_id, Branch.name, Fridge.name, Reader.time, Reader.temp, Reader.metric, Reader.status)
    ).where(where)
    columns = ["id", "logger_id", "branch", "fridge", "time", "temp", "metric", "status"]
    readings = session.execute(insert(ReaderArchive).from_select(columns, rows)).rowcount
    alert_rows = select(Alert.id, Alert.reader_id, Alert.description, Alert.level).where(Alert.reader_id.in_(ids))
    alerts = session.execute(insert(AlertArchive).from_select(["id", "reader_id", "description", "level"], alert_rows)).rowcount
    session.execute(delete(Alert).where(Alert.reader_id.in_(ids)).execution_options(**_NO_SYNC))
    if delete_readings:
        session.execute(delete(Reader).where(Reader.id.in_(ids)).execution_options(**_NO_SYNC))
    if readings:
        logger.info("Archived %d readings and %d alerts", readings, alerts)
    return readings


def clean_archive(session) -> ArchiveCounts:
    """Delete all archived readings and their archived alerts for good."""
    alerts = session.execute(delete(AlertArchive)).rowcount
    readings = session.execute(delete(ReaderArchive)).rowcount
    session.commit()
    logger.info("Cleaned the archive: deleted %d readings and %d alerts", readings, alerts)
    return ArchiveCounts(readings=readings, alerts=alerts)


_ARCHIVE_FILTER = {Branch: Branch.id, Fridge: Fridge.id, Logger: Logger.id, Reader: Reader.id}


@event.listens_for(Session, "before_flush")
def _archive_before_delete(session, flush_context, instances):
    """Archive the history under every branch, fridge, logger or reading the flush deletes."""
    for obj in list(session.deleted):
        column = _ARCHIVE_FILTER.get(type(obj))
        if column is not None:
            logger.info("Deleting %s id=%s; archiving its readings first", type(obj).__name__, obj.id)
            archive_readings(session, column == obj.id, delete_readings=not isinstance(obj, Reader))
