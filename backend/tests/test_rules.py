from datetime import datetime, timedelta

import pytest

from app.models import AlertLevel, Metric
from app.services.detection.rules import Point, Thresholds, find_gaps, find_growth
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


def test_rise_at_or_above_growth_urgent_over_four_readings_is_urgent():
    """Rishon 4.6 -> 7.1 rises 2.5°C with no step down, at least growth_urgent: urgent on the 4th reading."""
    [finding] = find_growth(points(4.6, 5.4, 6.3, 7.1), T)

    assert (finding.point_id, finding.level) == (3, AlertLevel.URGENT)
    assert finding.description == "Temperature rose 2.5°C over the last 4 readings"


def test_rise_between_the_growth_thresholds_is_non_urgent():
    """3.8, 3.8, 3.9, 3.9 rises 0.1°C: at least growth_non_urgent, below growth_urgent."""
    [finding] = find_growth(points(3.8, 3.8, 3.9, 3.9), T)

    assert finding.level is AlertLevel.NON_URGENT


def test_rise_below_growth_non_urgent_is_not_alerted():
    """3.80, 3.82, 3.84, 3.86 rises 0.06°C, below growth_non_urgent."""
    assert find_growth(points(3.80, 3.82, 3.84, 3.86), T) == []


def test_the_fridges_profile_sets_the_growth_levels():
    """The same 0.5°C rise is non-urgent with the default profile and urgent when growth_urgent is 0.4."""
    rising = points(4.0, 4.2, 4.3, 4.5)
    strict = Thresholds(0.1, 0.4, 1.5, 3.0, 15, 120)

    assert find_growth(rising, T)[0].level is AlertLevel.NON_URGENT
    assert find_growth(rising, strict)[0].level is AlertLevel.URGENT


def test_window_with_a_drop_is_not_growth():
    """A step down inside the 4 readings (the Tel Aviv spike) breaks the trend."""
    assert find_growth(points(4.0, 4.1, 9.4, 4.3), T) == []


def test_err_readings_are_skipped_in_the_window():
    """An ERR reading is skipped; the window uses the next OK readings."""
    readings = points(4.0, None, 4.1, 4.2, 4.4)

    [finding] = find_growth(readings, T)

    assert (finding.point_id, finding.level) == (4, AlertLevel.NON_URGENT)


def test_fewer_than_four_readings_is_not_a_trend():
    """Jerusalem has only 3 unique readings: no growth window."""
    assert find_growth(points(4.6, 5.4, 6.3), T) == []
