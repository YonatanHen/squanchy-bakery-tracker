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
    """The fridge's threshold settings values, in °C and minutes."""

    growth_non_urgent: float
    growth_urgent: float
    min_temp: float
    max_temp: float
    gap_non_urgent_minutes: int
    gap_urgent_minutes: int


@dataclass(frozen=True)
class Finding:
    """An alert to create on a reading."""

    point_id: int
    level: AlertLevel
    description: str


WINDOW = 4  # readings in a growth trend
DEVIATION_NON_URGENT, DEVIATION_URGENT = 1.5, 3.0  # °C; removed when the limit rule replaces the deviation rule


def _level(value: float, non_urgent: float, urgent: float) -> AlertLevel | None:
    """URGENT at or above the urgent threshold, NON_URGENT at or above the non-urgent one, else None."""
    if value >= urgent:
        return AlertLevel.URGENT
    if value >= non_urgent:
        return AlertLevel.NON_URGENT
    return None


def find_growth(points: list[Point], t: Thresholds) -> list[Finding]:
    """Alert when the last readings rise without a step down by at least the fridge's growth thresholds."""
    findings = []
    ok = [p for p in _by_time(points) if p.temp_c is not None]
    for end in range(WINDOW - 1, len(ok)):
        window = ok[end - WINDOW + 1 : end + 1]
        current = window[-1]
        if not current.is_new or any(b.temp_c < a.temp_c for a, b in zip(window, window[1:])):
            continue
        total = round(current.temp_c - window[0].temp_c, 2)
        level = _level(total, t.growth_non_urgent, t.growth_urgent)
        if level:
            findings.append(Finding(current.id, level, f"Temperature rose {total:.1f}°C over the last {WINDOW} readings"))
    return findings


def find_deviations(points: list[Point], t: Thresholds) -> tuple[list[Finding], float | None]:
    """Compare each reading to the running average, above or below; spikes are alerted but not averaged.

    Args:
        points: All readings of one fridge (old and new), in °C.
        t: The fridge's threshold settings.

    Returns:
        Findings for new readings, and the average of the non-spike OK readings (None if there are none).
    """
    findings = []
    ok = [p for p in _by_time(points) if p.temp_c is not None]
    total, count = 0.0, 0
    for index, point in enumerate(ok):
        if count == 0:
            total, count = point.temp_c, 1
            continue
        average = total / count
        deviation = round(point.temp_c - average, 2)
        if abs(deviation) < DEVIATION_NON_URGENT:
            total, count = total + point.temp_c, count + 1
            continue
        following = ok[index + 1] if index + 1 < len(ok) else None
        if following is not None and abs(following.temp_c - average) < DEVIATION_NON_URGENT:
            # Spike: the next reading is back to normal, e.g. a door opened for a delivery.
            if point.is_new:
                findings.append(Finding(
                    point.id, AlertLevel.NON_URGENT, f"Spike: {point.temp_c:.1f}°C against an average of {average:.1f}°C",
                ))
            continue
        if point.is_new:
            level = _level(abs(deviation), DEVIATION_NON_URGENT, DEVIATION_URGENT)
            direction = "above" if deviation > 0 else "below"
            findings.append(Finding(
                point.id, level,
                f"{point.temp_c:.1f}°C is {abs(deviation):.1f}°C {direction} the fridge average of {average:.1f}°C",
            ))
        total, count = total + point.temp_c, count + 1
    return findings, (total / count if count else None)


def _by_time(points: list[Point]) -> list[Point]:
    """Readings in time order (rows can arrive out of order)."""
    return sorted(points, key=lambda p: (p.time, p.id))


def find_gaps(points: list[Point], t: Thresholds) -> list[Finding]:
    """Alert on new readings that come after a gap longer than the fridge's gap thresholds."""
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
