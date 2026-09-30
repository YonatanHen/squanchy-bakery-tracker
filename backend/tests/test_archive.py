from datetime import datetime

import pytest

from app.models import Alert, AlertKind, AlertLevel, Branch, Fridge, Logger, Metric, Reader, Status
from app.models.archive import AlertArchive, ReaderArchive
from tests.helpers import SAMPLE_REGISTRATION, add_fridge, load_sample


def _cream_cakes_reading_with_urgent_alert(session) -> Reader:
    """Rishon's Cream cakes 7.1°C reading with its URGENT growth alert."""
    add_fridge(session, branch="Rishon LeZion", fridge="Cream cakes", logger="TL-0388")
    reading = Reader(logger_id="TL-0388", time=datetime(2026, 9, 14, 6, 45), temp=7.1, metric=Metric.C, status=Status.OK)
    reading.alerts.append(Alert(
        description="Temperature rose 2.5°C over the last 4 readings", level=AlertLevel.URGENT, kind=AlertKind.GROWTH,
    ))
    session.add(reading)
    session.commit()
    return reading


def test_deleting_a_branch_moves_its_readings_and_alerts_to_the_archive(session):
    """The branch is deleted, and the user can still answer where and when the alert happened."""
    reading = _cream_cakes_reading_with_urgent_alert(session)

    session.delete(reading.logger.fridge.branch)
    session.commit()

    for model in (Branch, Fridge, Logger, Reader, Alert):
        assert session.query(model).count() == 0
    archived = session.query(ReaderArchive).one()
    assert (archived.branch, archived.fridge, archived.logger_id, archived.temp) == (
        "Rishon LeZion", "Cream cakes", "TL-0388", 7.1,
    )
    assert archived.archived_at is not None
    alert = session.query(AlertArchive).one()
    assert (alert.reader_id, alert.level, alert.kind) == (archived.id, AlertLevel.URGENT, AlertKind.GROWTH)


def test_deleting_one_reading_archives_it_and_keeps_the_fridge(session):
    """A reading deleted by mistake is still in the archive, with its alert."""
    reading = _cream_cakes_reading_with_urgent_alert(session)

    session.delete(reading)
    session.commit()

    assert (session.query(Reader).count(), session.query(Alert).count(), session.query(Fridge).count()) == (0, 0, 1)
    assert session.query(ReaderArchive).one().time == datetime(2026, 9, 14, 6, 45)
    assert session.query(AlertArchive).count() == 1


def _sample_reading_id(session, logger_id: str, time: datetime) -> int:
    """Id of the sample's reading of the logger at that time."""
    return session.query(Reader).filter_by(logger_id=logger_id, time=time).one().id


def test_clean_archive_deletes_all_archived_readings_and_their_alerts(client, session, auth_headers):
    """After two deletes, cleaning the archive empties both archive tables and returns what it deleted."""
    load_sample(session)
    for logger_id, time in (("TL-0388", datetime(2026, 9, 14, 6, 45)), ("TL-0512", datetime(2026, 9, 14, 8, 30))):
        client.delete(f"/api/v1/readings/{_sample_reading_id(session, logger_id, time)}", headers=auth_headers)
    archived_alerts = session.query(AlertArchive).count()

    response = client.delete("/api/v1/readings/archive", headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json() == {"readings": 2, "alerts": archived_alerts}
    session.expire_all()
    assert (session.query(ReaderArchive).count(), session.query(AlertArchive).count()) == (0, 0)


def test_restore_brings_an_archived_reading_back_with_fresh_alerts(client, session, auth_headers):
    """Rishon registered as °F by mistake; its 06:45 reading is deleted, the fridge is fixed to °C, then the reading is restored."""
    wrong_unit = [{**f, "metric": "F"} if f["logger_id"] == "TL-0388" else f for f in SAMPLE_REGISTRATION["fridges"]]
    load_sample(session, {**SAMPLE_REGISTRATION, "fridges": wrong_unit})
    reading_id = _sample_reading_id(session, "TL-0388", datetime(2026, 9, 14, 6, 45))
    client.delete(f"/api/v1/readings/{reading_id}", headers=auth_headers)
    fridge_id = session.get(Logger, "TL-0388").fridge_id
    client.patch(f"/api/v1/fridges/{fridge_id}", json={"metric": "C"}, headers=auth_headers)

    response = client.post(f"/api/v1/readings/archive/{reading_id}/restore", headers=auth_headers)

    assert response.status_code == 200
    assert (response.get_json()["temp"], response.get_json()["metric"]) == (7.1, "C")
    session.expire_all()
    assert session.get(Reader, reading_id).metric == Metric.C
    assert (session.get(ReaderArchive, reading_id), session.query(AlertArchive).filter_by(reader_id=reading_id).count()) == (None, 0)
    alerts = session.query(Alert).filter_by(reader_id=reading_id).all()
    assert sorted(a.level.value for a in alerts) == sorted([AlertLevel.NON_URGENT.value, AlertLevel.URGENT.value])
    assert "Temperature rose 2.5°C over the last 4 readings" in [a.description for a in alerts]
    assert session.get(Fridge, fridge_id).avg_temp == pytest.approx(5.85, abs=0.01)


def test_restore_when_the_logger_no_longer_exists_is_a_409(client, session, auth_headers):
    """Rishon's fridge was deleted with its logger TL-0388: its archived reading cannot go back and stays archived."""
    load_sample(session)
    reading_id = _sample_reading_id(session, "TL-0388", datetime(2026, 9, 14, 6, 45))
    client.delete(f"/api/v1/fridges/{session.get(Logger, 'TL-0388').fridge_id}", headers=auth_headers)

    response = client.post(f"/api/v1/readings/archive/{reading_id}/restore", headers=auth_headers)

    assert response.status_code == 409
    assert "TL-0388" in response.get_json()["error"]
    session.expire_all()
    assert session.get(ReaderArchive, reading_id) is not None


def test_restore_to_a_time_the_logger_already_has_is_a_409(client, session, auth_headers):
    """Jerusalem's 08:30 reading was deleted and its 06:15 reading corrected to 08:30: the old one cannot come back."""
    load_sample(session)
    reading_id = _sample_reading_id(session, "TL-0512", datetime(2026, 9, 14, 8, 30))
    client.delete(f"/api/v1/readings/{reading_id}", headers=auth_headers)
    other_id = _sample_reading_id(session, "TL-0512", datetime(2026, 9, 14, 6, 15))
    client.patch(f"/api/v1/readings/{other_id}", json={"time": "2026-09-14T08:30"}, headers=auth_headers)

    response = client.post(f"/api/v1/readings/archive/{reading_id}/restore", headers=auth_headers)

    assert response.status_code == 409
    assert "TL-0512" in response.get_json()["error"]
    session.expire_all()
    assert session.get(ReaderArchive, reading_id) is not None
