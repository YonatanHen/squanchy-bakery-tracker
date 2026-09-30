import logging

from sqlalchemy import select

from app.models import Alert, Fridge, Logger, Reader
from app.services.detection.rules import Point, Thresholds, find_deviations, find_gaps, find_growth
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


def _store_stats(fridge: Fridge, points: list[Point]) -> None:
    """Save the time of the fridge's last reading."""
    fridge.last_measured = max((p.time for p in points), default=None)


def detect(session, fridge_ids: set[int], new_reader_ids: set[int]) -> int:
    """Run the gap, growth and deviation rules on the new readings of each fridge.

    Args:
        session: The SQLAlchemy session; the caller commits.
        fridge_ids: Fridges that got new readings.
        new_reader_ids: Ids of the readings saved in this upload.

    Returns:
        The number of alerts added.
    """
    added = 0
    for fridge_id in fridge_ids:
        fridge = session.get(Fridge, fridge_id)
        points = _points(session, fridge_id, new_reader_ids)
        t = _thresholds(fridge)
        deviations, _ = find_deviations(points, t)
        for finding in find_gaps(points, t) + find_growth(points, t) + deviations:
            session.add(Alert(
                reader_id=finding.point_id, level=finding.level, description=finding.description, kind=finding.kind,
            ))
            added += 1
        _store_stats(fridge, points)
    logger.info("Detection on %d fridges added %d alerts", len(fridge_ids), added)
    return added


def refresh_fridge_stats(session, fridge: Fridge) -> None:
    """Recompute the fridge's last reading after a delete; adds no alerts."""
    _store_stats(fridge, _points(session, fridge.id, set()))
