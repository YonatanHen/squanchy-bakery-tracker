from dataclasses import dataclass
from datetime import datetime

from app.models import AlertLevel


@dataclass(frozen=True)
class Point:
    """One reading of a fridge as the rules see it; is_new marks readings from the current upload."""

    id: int
    time: datetime
    temp_c: float | None  # None for an ERR reading
    is_new: bool


@dataclass(frozen=True)
class Thresholds:
    """The fridge's threshold profile values, in °C and minutes."""

    growth_non_urgent: float
    growth_urgent: float
    deviation_non_urgent: float
    deviation_urgent: float
    gap_non_urgent_minutes: int
    gap_urgent_minutes: int


@dataclass(frozen=True)
class Finding:
    """An alert to create on a reading."""

    point_id: int
    level: AlertLevel
    description: str


def _by_time(points: list[Point]) -> list[Point]:
    """Readings in time order (rows can arrive out of order)."""
    return sorted(points, key=lambda p: (p.time, p.id))


def find_gaps(points: list[Point], t: Thresholds) -> list[Finding]:
    """Alert on new readings that come after a gap longer than the profile's gap thresholds."""
    findings = []
    ordered = _by_time(points)
    for previous, current in zip(ordered, ordered[1:]):
        if not current.is_new:
            continue
        minutes = (current.time - previous.time).total_seconds() / 60
        if minutes >= t.gap_urgent_minutes:
            level = AlertLevel.URGENT
        elif minutes > t.gap_non_urgent_minutes:
            level = AlertLevel.NON_URGENT
        else:
            continue
        duration = f"{int(minutes // 60)}h {int(minutes % 60)}m"
        findings.append(Finding(current.id, level, f"No reading for {duration} before this reading"))
    return findings
