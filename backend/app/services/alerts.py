import logging

from sqlalchemy import func, select

from app.models import Alert, Branch, Fridge, Logger, Reader
from app.schemas.alert import AlertFilters
from app.services.readings import apply_location_filters

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
