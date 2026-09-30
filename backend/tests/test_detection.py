from datetime import datetime

import pytest

from app.models import Alert, AlertKind, AlertLevel, Logger, Metric, ThresholdSettings
from app.services.ingest.parsers.base import RawRow
from app.services.ingest.service import ingest_rows
from tests.helpers import add_fridge, load_sample


def alerts(session) -> list[tuple]:
    """(logger, reading time, level) of every alert, sorted."""
    return sorted((a.reader.logger_id, a.reader.time, a.level) for a in session.query(Alert))


def test_sample_week_creates_exactly_the_expected_alerts(session):
    """The sample file gives 5 alerts: Rishon above 5°C and rising, Tel Aviv's one-reading jump, and two gaps."""
    result = load_sample(session)

    assert result.alerts == 5
    assert alerts(session) == [
        ("TL-0388", datetime(2026, 9, 14, 6, 15), AlertLevel.URGENT),      # above 5°C since 06:15
        ("TL-0388", datetime(2026, 9, 14, 6, 45), AlertLevel.URGENT),      # growth
        ("TL-0417", datetime(2026, 9, 14, 6, 15), AlertLevel.NON_URGENT),  # one reading above 5°C
        ("TL-0417", datetime(2026, 9, 17, 6, 0), AlertLevel.URGENT),       # 3-day gap
        ("TL-0512", datetime(2026, 9, 14, 8, 30), AlertLevel.URGENT),      # 2h15 gap
    ]


def test_a_later_upload_that_continues_a_period_replaces_its_alert(session):
    """Rishon is still warm at 07:00 and back at 07:15: one LIMIT alert with the whole period, not two."""
    load_sample(session)
    rows = [
        RawRow(2, {"logger": "TL-0388", "branch": "Rishon LeZion", "fridge": "Cream cakes", "time": "2026-09-14 07:00", "temp": 7.5}),
        RawRow(3, {"logger": "TL-0388", "branch": "Rishon LeZion", "fridge": "Cream cakes", "time": "2026-09-14 07:15", "temp": 4.5}),
    ]

    ingest_rows(session, rows)

    limits = [a.description for a in session.query(Alert) if a.kind is AlertKind.LIMIT and a.reader.logger_id == "TL-0388"]
    assert limits == ["Above 5.0°C from 14/09 06:15 to 07:15 (1h 0m), peak 7.5°C"]


def test_each_alert_has_the_kind_of_rule_that_raised_it(session):
    """Gap alerts are GAP and growth alerts are GROWTH, so detection can find and replace them later."""
    load_sample(session)

    kinds = {a.kind for a in session.query(Alert) if a.description.startswith("No reading")}
    growth = {a.kind for a in session.query(Alert) if "rose" in a.description}

    assert (kinds, growth) == ({AlertKind.GAP}, {AlertKind.GROWTH})


def test_the_fridge_stores_the_time_of_its_last_reading(session):
    """Display 2's last reading is the 17/09 one; the fridge keeps no average."""
    load_sample(session)

    display = session.get(Logger, "TL-0417").fridge
    assert display.last_measured == datetime(2026, 9, 17, 6, 0)
    assert not hasattr(display, "avg_temp")


def test_a_fridges_threshold_settings_change_only_its_alerts(session):
    """Moving Cream cakes to threshold settings with growth_urgent 3.0 makes its 2.5°C rise non-urgent; others keep the default."""
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


def test_fahrenheit_readings_are_checked_against_the_celsius_limits(session):
    """Haifa's 40°F (4.4°C) is within the 5°C limit; 42°F and 43°F (5.6°C, 6.1°C) are above it."""
    add_fridge(session, branch="Haifa", fridge="Dairy", logger="TL-0231", metric=Metric.F)
    rows = [
        RawRow(i, {"logger": "TL-0231", "branch": "Haifa", "fridge": "Dairy", "time": f"14/09/2026 {6 + i // 4:02d}:{15 * (i % 4):02d}", "temp": temp})
        for i, temp in enumerate([38.0, 40.0, 42.0, 43.0, 38.0])
    ]

    ingest_rows(session, rows)

    limits = [a.description for a in session.query(Alert) if a.kind is AlertKind.LIMIT]
    assert limits == ["Above 5.0°C from 14/09 06:30 to 07:00 (30 min), peak 6.1°C"]
