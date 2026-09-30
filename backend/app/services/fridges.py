import logging

from sqlalchemy import delete, func, select, update

from app.models import Alert, Fridge, Logger, Reader, ThresholdSettings
from app.services.detection.service import detect
from app.services.errors import get_or_raise

logger = logging.getLogger(__name__)


def count_impact(session, fridge_filter) -> dict[str, int]:
    """Count the fridges, loggers, readings and alerts under the matching fridges.

    Args:
        session: The SQLAlchemy session.
        fridge_filter: Filter on Fridge, e.g. `Fridge.branch_id == 2`.

    Returns:
        Counts keyed by fridges, loggers, readings, alerts.
    """
    def count(column, *joins):
        stmt = select(func.count(column)).select_from(Fridge)
        for target, on in joins:
            stmt = stmt.join(target, on)
        return session.scalar(stmt.where(fridge_filter))

    logger_join = (Logger, Logger.fridge_id == Fridge.id)
    reader_join = (Reader, Reader.logger_id == Logger.id)
    return {
        "fridges": count(Fridge.id),
        "loggers": count(Logger.id, logger_join),
        "readings": count(Reader.id, logger_join, reader_join),
        "alerts": count(Alert.id, logger_join, reader_join, (Alert, Alert.reader_id == Reader.id)),
    }


def fridge_delete_impact(session, fridge_id: int) -> dict[str, int]:
    """Counts of what deleting this fridge would remove or archive; deletes nothing."""
    get_or_raise(session, Fridge, fridge_id)
    return count_impact(session, Fridge.id == fridge_id)


def delete_fridge(session, fridge_id: int) -> None:
    """Delete a fridge with its logger and thresholds; its readings and alerts go to the archive."""
    session.delete(get_or_raise(session, Fridge, fridge_id))
    session.commit()
    logger.info("Deleted fridge id=%s", fridge_id)


def _relabel_readings(session, fridge: Fridge) -> None:
    """Mark the fridge's readings with its new unit (values unchanged), then run the alert rules on them again."""
    reader_ids = set(session.scalars(select(Reader.id).join(Logger).where(Logger.fridge_id == fridge.id)))
    if not reader_ids:
        return
    session.execute(update(Reader).where(Reader.id.in_(reader_ids)).values(metric=fridge.metric))
    session.execute(delete(Alert).where(Alert.reader_id.in_(reader_ids)).execution_options(synchronize_session=False))
    session.flush()
    detect(session, {fridge.id}, reader_ids)
    logger.info("Relabeled %d readings of fridge id=%s as %s", len(reader_ids), fridge.id, fridge.metric.value)


def update_fridge(session, fridge_id: int, changes: dict) -> Fridge:
    """Apply field changes to a fridge; a new logger id replaces its logger and its readings follow.

    Args:
        session: The SQLAlchemy session.
        fridge_id: The fridge to edit; NotFoundError if it does not exist.
        changes: Validated values for name, metric, logger_id and/or threshold_settings_id.

    Returns:
        The updated fridge.
    """
    fridge = get_or_raise(session, Fridge, fridge_id)
    changes = dict(changes)
    unit_changed = "metric" in changes and changes["metric"] != fridge.metric
    if "threshold_settings_id" in changes:
        fridge.threshold_settings = get_or_raise(session, ThresholdSettings, changes.pop("threshold_settings_id"))
    if "logger_id" in changes:
        new_id = changes.pop("logger_id")
        if fridge.logger:
            fridge.logger.id = new_id  # ON UPDATE CASCADE moves the readings to the new id
        else:
            fridge.logger = Logger(id=new_id)
    for field, value in changes.items():
        setattr(fridge, field, value)
    if unit_changed:
        _relabel_readings(session, fridge)
    session.commit()
    logger.info("Updated fridge id=%s", fridge_id)
    return fridge
