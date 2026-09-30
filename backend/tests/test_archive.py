from datetime import datetime

from app.models import Alert, AlertLevel, Branch, Fridge, Logger, Metric, Reader, Status
from app.models.archive import AlertArchive, ReaderArchive
from tests.helpers import add_fridge, load_sample


def _cream_cakes_reading_with_urgent_alert(session) -> Reader:
    """Rishon's Cream cakes 7.1°C reading with its URGENT growth alert."""
    add_fridge(session, branch="Rishon LeZion", fridge="Cream cakes", logger="TL-0388")
    reading = Reader(logger_id="TL-0388", time=datetime(2026, 9, 14, 6, 45), temp=7.1, metric=Metric.C, status=Status.OK)
    reading.alerts.append(Alert(description="Temperature rose 2.5°C over the last 4 readings", level=AlertLevel.URGENT))
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
    assert (alert.reader_id, alert.level) == (archived.id, AlertLevel.URGENT)


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
