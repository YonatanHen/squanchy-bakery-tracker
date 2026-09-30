import logging

from sqlalchemy import delete, select

from app.models import Alert, AlertKind, Fridge, Logger, Reader
from app.services.detection.rules import Point, Thresholds, find_gaps, find_growth, find_limits
from app.services.units import to_celsius

logger = logging.getLogger(__name__)


def _points(session, fridge_id: int, new_ids: set[int]) -> list[Point]:
    """All readings of the fridge in °C; new_ids marks the ones from the current save."""
    readers = session.scalars(select(Reader).join(Logger).where(Logger.fridge_id == fridge_id))
    return [
        Point(r.id, r.time, None if r.temp is None else to_celsius(r.temp, r.metric), r.id in new_ids)
        for r in readers
    ]


def _thresholds(fridge: Fridge) -> Thresholds:
    """The fridge's threshold settings as rule input."""
    s = fridge.threshold_settings
    return Thresholds(
        s.growth_non_urgent, s.growth_urgent, s.min_temp, s.max_temp,
        s.gap_non_urgent_minutes, s.gap_urgent_minutes,
    )


def _drop_limit_alerts(session, points: list[Point]) -> int:
    """Delete the fridge's LIMIT alerts; they are rebuilt from all its readings. Returns how many."""
    ids = [p.id for p in points]
    stmt = delete(Alert).where(Alert.kind == AlertKind.LIMIT, Alert.reader_id.in_(ids))
    return session.execute(stmt.execution_options(synchronize_session="fetch")).rowcount


def detect(session, fridge_ids: set[int], new_reader_ids: set[int]) -> int:
    """Run the gap and growth rules on the new readings, and rebuild the limit periods of each fridge.

    Args:
        session: The SQLAlchemy session; the caller commits.
        fridge_ids: Fridges whose readings changed.
        new_reader_ids: Ids of the readings saved or changed now; empty after a delete.

    Returns:
        The number of alerts added, less the limit alerts they replace.
    """
    added = 0
    for fridge_id in fridge_ids:
        fridge = session.get(Fridge, fridge_id)
        points = _points(session, fridge_id, new_reader_ids)
        t = _thresholds(fridge)
        added -= _drop_limit_alerts(session, points)
        for finding in find_gaps(points, t) + find_growth(points, t) + find_limits(points, t):
            session.add(Alert(
                reader_id=finding.point_id, level=finding.level, description=finding.description, kind=finding.kind,
            ))
            added += 1
        fridge.last_measured = max((p.time for p in points), default=None)
    logger.info("Detection on %d fridges added %d alerts", len(fridge_ids), added)
    return added
