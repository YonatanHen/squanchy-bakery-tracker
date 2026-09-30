from datetime import datetime

import pytest

from app.models import Alert, AlertLevel, Logger, Metric, ThresholdSettings
from app.services.ingest.parsers.base import RawRow
from app.services.ingest.service import ingest_rows
from tests.helpers import add_fridge, load_sample


def alerts(session) -> list[tuple]:
    """(logger, reading time, level) of every alert, sorted."""
    return sorted((a.reader.logger_id, a.reader.time, a.level) for a in session.query(Alert))


def test_sample_week_creates_exactly_the_expected_alerts(session):
    """The sample file gives the 5 alerts of the spec: growth, deviation, spike and two gaps."""
    result = load_sample(session)

    assert result.alerts == 5
    assert alerts(session) == [
        ("TL-0388", datetime(2026, 9, 14, 6, 45), AlertLevel.NON_URGENT),  # deviation
        ("TL-0388", datetime(2026, 9, 14, 6, 45), AlertLevel.URGENT),      # growth
        ("TL-0417", datetime(2026, 9, 14, 6, 15), AlertLevel.NON_URGENT),  # spike
        ("TL-0417", datetime(2026, 9, 17, 6, 0), AlertLevel.URGENT),       # 3-day gap
        ("TL-0512", datetime(2026, 9, 14, 8, 30), AlertLevel.URGENT),      # 2h15 gap
    ]


def test_fridge_average_and_last_measured_are_stored_in_the_fridge_unit(session):
    """Display 2's average leaves out the spike; Haifa's average is stored in °F."""
    load_sample(session)

    display = session.get(Logger, "TL-0417").fridge
    haifa = session.get(Logger, "TL-0231").fridge
    assert display.avg_temp == pytest.approx(4.025, abs=0.01)
    assert display.last_measured == datetime(2026, 9, 17, 6, 0)
    assert haifa.avg_temp == pytest.approx(38.65, abs=0.01)


def test_a_fridges_profile_changes_only_its_alerts(session):
    """Moving Cream cakes to a profile with growth_urgent 3.0 makes its 2.5°C rise non-urgent; others keep the default."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")
    add_fridge(session, branch="Haifa", fridge="Dairy", logger="TL-0231", metric=Metric.F)
    cakes = add_fridge(session, branch="Rishon LeZion", fridge="Cream cakes", logger="TL-0388")
    cakes.threshold_settings = ThresholdSettings(name="Cream cakes", growth_urgent=3.0)
    session.commit()

    load_sample(session, register=None)

    growth = [a.level for a in session.query(Alert) if a.reader.logger_id == "TL-0388" and "rose" in a.description]
    assert growth == [AlertLevel.NON_URGENT]
    assert ("TL-0512", datetime(2026, 9, 14, 8, 30), AlertLevel.URGENT) in alerts(session)


def test_readings_across_midnight_in_an_upload_raise_no_gap(session):
    """An upload with 14/09 23:45 and 15/09 00:00 (in both date formats) creates no gap alert."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    rows = [
        RawRow(2, {"logger": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy", "time": "2026-09-14 23:45", "temp": 3.8}),
        RawRow(3, {"logger": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy", "time": "15/09/2026 00:00", "temp": 3.9}),
    ]

    result = ingest_rows(session, rows)

    assert (result.inserted, result.alerts) == (2, 0)


def test_fahrenheit_rise_below_the_celsius_threshold_is_not_a_deviation(session):
    """A 2°F rise is about 1.1°C, below the 1.5°C deviation threshold: no deviation alert for Haifa."""
    add_fridge(session, branch="Haifa", fridge="Dairy", logger="TL-0231", metric=Metric.F)
    rows = [
        RawRow(i, {"logger": "TL-0231", "branch": "Haifa", "fridge": "Dairy", "time": f"14/09/2026 06:{15 * i:02d}", "temp": temp})
        for i, temp in enumerate([38.0, 38.0, 40.0])
    ]

    ingest_rows(session, rows)

    assert [a.description for a in session.query(Alert) if "average" in a.description] == []
