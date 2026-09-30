from datetime import datetime

import pytest

from app.models import Alert, AlertLevel, Logger, Reader, Status
from app.models.archive import AlertArchive, ReaderArchive
from tests.helpers import load_sample


def reading(session, logger_id, time) -> Reader:
    """The stored reading of the logger at that time."""
    return session.query(Reader).filter_by(logger_id=logger_id, time=time).one()


def test_patch_temperature_recalculates_the_fridge_average(client, session, auth_headers):
    """Correcting Jerusalem's 08:30 reading to 4.4°C updates the reading and the fridge average."""
    load_sample(session)
    target = reading(session, "TL-0512", datetime(2026, 9, 14, 8, 30))

    response = client.patch(f"/api/v1/readings/{target.id}", json={"temp": 4.4}, headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()["temp"] == 4.4
    session.expire_all()
    assert session.get(Logger, "TL-0512").fridge.avg_temp == pytest.approx(4.03, abs=0.01)


def test_patch_to_err_clears_the_temperature(client, session, auth_headers):
    """Setting a reading to ERR removes its temperature and marks it ERR."""
    load_sample(session)
    target = reading(session, "TL-0512", datetime(2026, 9, 14, 8, 30))

    body = client.patch(f"/api/v1/readings/{target.id}", json={"temp": "ERR"}, headers=auth_headers).get_json()

    assert (body["temp"], body["status"]) == (None, Status.ERR.value)


def test_editing_a_reading_replaces_its_alerts(client, session, auth_headers):
    """Rishon 06:45 corrected 7.1 -> 6.5°C: its 2 old alerts are removed (edits are not archived) and detection runs again."""
    load_sample(session)
    target = reading(session, "TL-0388", datetime(2026, 9, 14, 6, 45))

    response = client.patch(f"/api/v1/readings/{target.id}", json={"temp": 6.5}, headers=auth_headers)

    assert response.status_code == 200
    session.expire_all()
    alerts = [(a.level, a.description) for a in session.query(Alert).filter_by(reader_id=target.id)]
    assert alerts == [(AlertLevel.URGENT, "Temperature rose 1.9°C over the last 4 readings")]
    assert session.query(AlertArchive).count() == 0


def test_moving_a_reading_onto_an_existing_time_is_a_conflict(client, session, auth_headers):
    """A logger cannot have two readings at the same time: 409, not 500."""
    load_sample(session)
    target = reading(session, "TL-0512", datetime(2026, 9, 14, 8, 30))

    response = client.patch(f"/api/v1/readings/{target.id}", json={"time": "2026-09-14 06:00"}, headers=auth_headers)

    assert response.status_code == 409


def test_delete_reading_archives_it_with_its_alerts_and_recalculates_the_average(client, session, auth_headers):
    """Deleting Rishon's 06:45 reading archives it with its 2 alerts; the average drops to 5.43°C."""
    load_sample(session)
    target = reading(session, "TL-0388", datetime(2026, 9, 14, 6, 45))

    assert client.delete(f"/api/v1/readings/{target.id}", headers=auth_headers).status_code == 204
    session.expire_all()
    assert session.query(Alert).count() == 3
    assert (session.query(ReaderArchive).count(), session.query(AlertArchive).count()) == (1, 2)
    assert session.get(Logger, "TL-0388").fridge.avg_temp == pytest.approx(5.43, abs=0.01)


def test_unknown_reading_returns_404(client, auth_headers):
    """Deleting a reading that does not exist returns 404."""
    assert client.delete("/api/v1/readings/999", headers=auth_headers).status_code == 404
