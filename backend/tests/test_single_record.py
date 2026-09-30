from app.models import Fridge, Reader
from tests.helpers import add_fridge

RECORD = {"logger": "TL-0388", "branch": "rishon lezion", "fridge": "Cream cakes", "time": "2026-09-14 07:00", "temp": 7.4}


def test_single_record_goes_through_the_same_validation_and_is_saved(client, session, auth_headers):
    """A record typed in the app is normalized and saved like an uploaded row."""
    add_fridge(session, branch="Rishon LeZion", fridge="Cream cakes", logger="TL-0388")

    response = client.post("/api/v1/readings", json=RECORD, headers=auth_headers)

    assert response.status_code == 201
    assert response.get_json()["inserted"] == 1
    assert session.query(Reader).one().temp == 7.4


def test_invalid_single_record_returns_field_errors_and_saves_nothing(client, session, auth_headers):
    """A record with a bad time and an empty temperature is rejected with both field errors."""
    add_fridge(session, branch="Rishon LeZion", fridge="Cream cakes", logger="TL-0388")

    response = client.post("/api/v1/readings", json={**RECORD, "time": "7am", "temp": None}, headers=auth_headers)

    assert response.status_code == 422
    assert {e["field"] for e in response.get_json()["errors"]} == {"time", "temp"}
    assert session.query(Reader).count() == 0


def test_single_record_for_a_new_fridge_asks_then_registers_it(client, session, auth_headers):
    """A record from an unknown logger is listed as unknown; after the user confirms, it is registered and saved."""
    add_fridge(session, branch="Rishon LeZion", fridge="Cream cakes", logger="TL-0388")
    record = {**RECORD, "logger": "TL-0389", "fridge": "Freezer", "temp": -18.0}

    first = client.post("/api/v1/readings", json=record, headers=auth_headers)
    register = {"fridges": [{"logger_id": "TL-0389", "branch": "Rishon LeZion", "fridge": "Freezer"}]}
    second = client.post("/api/v1/readings", json={**record, "register": register}, headers=auth_headers)

    assert first.status_code == 422
    assert first.get_json()["unknown"]["loggers"][0]["logger"] == "TL-0389"
    assert second.status_code == 201
    assert session.query(Fridge).count() == 2
