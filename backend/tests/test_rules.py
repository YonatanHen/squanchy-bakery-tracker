from datetime import datetime, timedelta

import pytest

from app.models import AlertLevel, Metric
from app.services.detection.rules import Point, Thresholds, find_gaps
from app.services.units import from_celsius, to_celsius

T = Thresholds(0.1, 1.0, 1.5, 3.0, 15, 120)  # the default profile
START = datetime(2026, 9, 14, 6, 0)


def points(*temps, minutes=15, new=True, start=START):
    """Readings every `minutes` from START with the given °C values."""
    return [Point(i, start + timedelta(minutes=minutes * i), t, new) for i, t in enumerate(temps)]


def test_haifa_fahrenheit_values_convert_to_celsius_and_back():
    """38.3°F is about 3.5°C; Celsius values are unchanged."""
    assert to_celsius(38.3, Metric.F) == pytest.approx(3.5, abs=0.01)
    assert to_celsius(3.8, Metric.C) == 3.8
    assert from_celsius(3.5, Metric.F) == pytest.approx(38.3)


def test_gap_within_the_non_urgent_threshold_is_not_alerted():
    """Readings exactly gap_non_urgent_minutes apart raise no gap alert."""
    assert find_gaps(points(3.8, 3.9, 4.0, minutes=T.gap_non_urgent_minutes), T) == []


def test_gap_at_or_above_the_urgent_threshold_is_urgent():
    """Jerusalem Dairy 06:15 -> 08:30 (2h15) is at least gap_urgent_minutes, so it is urgent on the 08:30 reading."""
    readings = [Point(1, START, 3.8, True), Point(2, START + timedelta(minutes=15), 3.9, True),
                Point(3, datetime(2026, 9, 14, 8, 30), 4.0, True)]

    [finding] = find_gaps(readings, T)

    assert (finding.point_id, finding.level) == (3, AlertLevel.URGENT)
    assert finding.description == "No reading for 2h 15m before this reading"


def test_gap_between_the_non_urgent_and_urgent_thresholds_is_non_urgent():
    """A gap above gap_non_urgent_minutes and below gap_urgent_minutes is non-urgent."""
    minutes = T.gap_non_urgent_minutes + 30

    [finding] = find_gaps(points(3.8, 3.9, minutes=minutes), T)

    assert finding.level is AlertLevel.NON_URGENT


def test_the_fridges_profile_sets_the_gap_levels():
    """The same 45-minute gap is urgent for a profile whose gap_urgent_minutes is 30."""
    strict = Thresholds(0.1, 1.0, 1.5, 3.0, 10, 30)

    [finding] = find_gaps(points(3.8, 3.9, minutes=45), strict)

    assert finding.level is AlertLevel.URGENT


def test_gaps_in_old_readings_are_not_alerted_again():
    """Gaps between readings of earlier uploads were already alerted."""
    assert find_gaps(points(3.8, 3.9, minutes=180, new=False), T) == []


def test_out_of_order_rows_are_sorted_before_checking_gaps():
    """The sample's 05:45 row arrives after 06:00; sorting by time avoids a false gap."""
    shuffled = [Point(1, START + timedelta(minutes=15), 4.1, True), Point(2, START, 4.0, True)]

    assert find_gaps(shuffled, T) == []
