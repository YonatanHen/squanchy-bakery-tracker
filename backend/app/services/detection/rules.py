from dataclasses import dataclass
from datetime import datetime

from app.models import AlertKind, AlertLevel


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
    kind: AlertKind


WINDOW = 4  # readings in a growth trend


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
            first = window[0].time
            minutes = (current.time - first).total_seconds() / 60
            text = (
                f"Temperature rose {total:.1f}°C from {first.strftime('%d/%m %H:%M')} "
                f"to {_clock(current.time, first)} ({_duration(minutes)})"
            )
            findings.append(Finding(current.id, level, text, AlertKind.GROWTH))
    return findings


def _by_time(points: list[Point]) -> list[Point]:
    """Readings in time order (rows can arrive out of order)."""
    return sorted(points, key=lambda p: (p.time, p.id))


def _duration(minutes: float) -> str:
    """Minutes as "30 min" below an hour, else "2h 15m"."""
    if minutes < 60:
        return f"{int(minutes)} min"
    return f"{int(minutes // 60)}h {int(minutes % 60)}m"


def _clock(time: datetime, start: datetime) -> str:
    """Time of day, with the date only when it differs from the start date."""
    return time.strftime("%H:%M") if time.date() == start.date() else time.strftime("%d/%m %H:%M")


def _side(temp_c: float, t: Thresholds) -> str | None:
    """ "Above" or "Below" when the reading is outside the fridge's limits, else None."""
    if temp_c > t.max_temp:
        return "Above"
    if temp_c < t.min_temp:
        return "Below"
    return None


def _limit_finding(period: list[Point], side: str, end: Point | None, t: Thresholds) -> Finding:
    """One alert for a period outside the limits; end is the first reading back within them, if any."""
    ok = [p for p in period if p.temp_c is not None]
    first, last = ok[0], ok[-1]
    limit = t.max_temp if side == "Above" else t.min_temp
    start = first.time.strftime("%d/%m %H:%M")
    level = AlertLevel.URGENT if len(ok) > 1 else AlertLevel.NON_URGENT
    if len(ok) == 1 and end is not None:
        text = (
            f"{side} {limit:.1f}°C at {start} for one reading ({first.temp_c:.1f}°C), "
            f"back to {end.temp_c:.1f}°C at {_clock(end.time, first.time)}"
        )
    else:
        peak = max(p.temp_c for p in ok) if side == "Above" else min(p.temp_c for p in ok)
        extreme = f"{'peak' if side == 'Above' else 'lowest'} {peak:.1f}°C"
        if end is None:
            minutes = (last.time - first.time).total_seconds() / 60
            text = (
                f"{side} {limit:.1f}°C since {start}, still {side.lower()} at the last reading "
                f"{_clock(last.time, first.time)} ({_duration(minutes)} so far), {extreme}"
            )
        else:
            minutes = (end.time - first.time).total_seconds() / 60
            text = f"{side} {limit:.1f}°C from {start} to {_clock(end.time, first.time)} ({_duration(minutes)}), {extreme}"
    timeline = period + ([end] if end else [])
    longest = max(((b.time - a.time).total_seconds() / 60 for a, b in zip(timeline, timeline[1:])), default=0)
    if longest > t.gap_non_urgent_minutes:
        text += f"; no readings for {_duration(longest)} inside this period"
    return Finding(first.id, level, text, AlertKind.LIMIT)


def find_limits(points: list[Point], t: Thresholds) -> list[Finding]:
    """One alert per period outside the fridge's min/max limits, old or new (detection replaces them all).

    A period starts at the first reading outside the limits and ends at the first reading back within them;
    an ERR reading does not end it. Two or more readings outside are URGENT, one is NON_URGENT.
    """
    findings: list[Finding] = []
    period: list[Point] = []
    side: str | None = None

    def close(end: Point | None) -> None:
        """Add the finding of the open period."""
        while period and period[-1].temp_c is None:  # trailing ERR readings are not part of the period
            period.pop()
        if period:
            findings.append(_limit_finding(period, side, end, t))

    for point in _by_time(points):
        if point.temp_c is None:
            if period:
                period.append(point)
            continue
        current = _side(point.temp_c, t)
        if period and current != side:
            close(point)
            period = []
        if current:
            side = current
            period.append(point)
    close(None)
    return findings


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
        findings.append(Finding(current.id, level, f"No reading for {duration} before this reading", AlertKind.GAP))
    return findings
