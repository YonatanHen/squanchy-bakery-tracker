import pytest

from app.models import Alert, AlertKind, Logger, ThresholdSettings
from tests.helpers import add_fridge, load_sample

DAIRY = {
    "name": "Dairy",
    "growth_non_urgent": 0.2, "growth_urgent": 1.5,
    "min_temp": 0.0, "max_temp": 4.0,
    "gap_non_urgent_minutes": 20, "gap_urgent_minutes": 90,
}


def threshold_settings(client, headers) -> dict[str, dict]:
    """GET /threshold-settings keyed by name."""
    response = client.get("/api/v1/threshold-settings", headers=headers)
    assert response.status_code == 200
    return {s["name"]: s for s in response.get_json()}


def test_list_threshold_settings_with_how_many_fridges_use_each(client, session, auth_headers):
    """The user sees the values of each threshold settings and how many fridges they affect."""
    add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")
    add_fridge(session, branch="Tel Aviv", fridge="Display 1", logger="TL-0418")

    default = threshold_settings(client, auth_headers)["default"]

    assert (default["fridges"], default["growth_urgent"], default["gap_urgent_minutes"]) == (2, 1.0, 120)


def test_create_threshold_settings_and_attach_a_fridge_to_them(client, session, auth_headers):
    """"Dairy" threshold settings are created and one fridge is moved to them."""
    fridge = add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    add_fridge(session, branch="Jerusalem", fridge="Freezer", logger="TL-0513")

    created = client.post("/api/v1/threshold-settings", json=DAIRY, headers=auth_headers)
    moved = client.patch(
        f"/api/v1/fridges/{fridge.id}", json={"threshold_settings_id": created.get_json()["id"]}, headers=auth_headers
    )

    assert created.status_code == 201
    assert moved.status_code == 200
    counts = {name: s["fridges"] for name, s in threshold_settings(client, auth_headers).items()}
    assert counts == {"default": 1, "Dairy": 1}


def test_edit_threshold_settings_rejects_non_urgent_above_urgent(client, session, auth_headers):
    """A non-urgent limit must be below its urgent limit; a valid edit is saved."""
    add_fridge(session)
    settings_id = threshold_settings(client, auth_headers)["default"]["id"]
    url = f"/api/v1/threshold-settings/{settings_id}"

    bad = client.put(url, json={**DAIRY, "name": "default", "growth_non_urgent": 2.0, "growth_urgent": 1.0}, headers=auth_headers)
    good = client.put(url, json={**DAIRY, "name": "default", "max_temp": 6.0}, headers=auth_headers)

    assert bad.status_code == 422
    assert good.status_code == 200
    assert good.get_json()["max_temp"] == 6.0


def test_min_temp_not_below_max_temp_is_reported_on_min_temp(client, session, auth_headers):
    """The min limit must be lower than the max limit; the error is shown under the min field."""
    add_fridge(session)
    settings_id = threshold_settings(client, auth_headers)["default"]["id"]

    response = client.put(
        f"/api/v1/threshold-settings/{settings_id}", json={**DAIRY, "min_temp": 5.0, "max_temp": 5.0}, headers=auth_headers
    )

    assert response.status_code == 422
    errors = {e["field"]: e["message"] for e in response.get_json()["errors"]}
    assert errors == {"min_temp": "Must be lower than the max limit"}


def test_non_urgent_above_urgent_is_reported_on_each_non_urgent_field(client, session, auth_headers):
    """Each wrong pair gets its own error on its non-urgent field, so the UI shows it under that field."""
    add_fridge(session)
    settings_id = threshold_settings(client, auth_headers)["default"]["id"]
    body = {**DAIRY, "growth_non_urgent": 2.0, "growth_urgent": 1.0, "gap_non_urgent_minutes": 200}

    response = client.put(f"/api/v1/threshold-settings/{settings_id}", json=body, headers=auth_headers)

    assert response.status_code == 422
    errors = {e["field"]: e["message"] for e in response.get_json()["errors"]}
    assert errors == {
        "growth_non_urgent": "Must be lower than the urgent limit",
        "gap_non_urgent_minutes": "Must be lower than the urgent limit",
    }


DEFAULT = {
    "name": "default", "growth_non_urgent": 0.1, "growth_urgent": 1.0,
    "min_temp": 0.0, "max_temp": 5.0, "gap_non_urgent_minutes": 15, "gap_urgent_minutes": 120,
}


def rishon_alert_kinds(session) -> list[AlertKind]:
    """Kinds of the alerts on Rishon's readings, sorted."""
    return sorted(a.kind for a in session.query(Alert) if a.reader.logger_id == "TL-0388")


def test_editing_threshold_settings_recalculates_the_alerts_of_their_fridges(client, session, auth_headers):
    """With max_temp 8°C, Rishon's 7.1°C is within the limits: its limit alert goes, its growth alert stays."""
    load_sample(session)
    settings_id = threshold_settings(client, auth_headers)["default"]["id"]

    response = client.put(f"/api/v1/threshold-settings/{settings_id}", json={**DEFAULT, "max_temp": 8.0}, headers=auth_headers)

    assert response.status_code == 200
    session.expire_all()
    assert rishon_alert_kinds(session) == [AlertKind.GROWTH]


def test_moving_a_fridge_to_other_threshold_settings_recalculates_its_alerts(client, session, auth_headers):
    """Cream cakes moved to settings with max_temp 8°C loses its limit alert."""
    load_sample(session)
    loose = client.post("/api/v1/threshold-settings", json={**DEFAULT, "name": "Cakes", "max_temp": 8.0}, headers=auth_headers)
    fridge_id = session.get(Logger, "TL-0388").fridge_id

    client.patch(f"/api/v1/fridges/{fridge_id}", json={"threshold_settings_id": loose.get_json()["id"]}, headers=auth_headers)

    session.expire_all()
    assert rishon_alert_kinds(session) == [AlertKind.GROWTH]


def test_duplicate_threshold_settings_name_returns_409_on_the_name_field(client, auth_headers):
    """A second "dairy" (any case) is refused with an error on the name field."""
    client.post("/api/v1/threshold-settings", json=DAIRY, headers=auth_headers)

    response = client.post("/api/v1/threshold-settings", json={**DAIRY, "name": "dairy"}, headers=auth_headers)

    assert response.status_code == 409
    assert response.get_json()["errors"] == [{"field": "name", "message": "This name is already used"}]


def test_deleting_threshold_settings_in_use_says_how_many_fridges_use_them(client, session, auth_headers):
    """The 409 tells the user how many fridges to move first."""
    add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")
    add_fridge(session, branch="Tel Aviv", fridge="Display 1", logger="TL-0418")
    default_id = threshold_settings(client, auth_headers)["default"]["id"]

    response = client.delete(f"/api/v1/threshold-settings/{default_id}", headers=auth_headers)

    assert response.status_code == 409
    assert response.get_json()["error"] == "Used by 2 fridges. Move them to other threshold settings first."


def test_threshold_settings_in_use_cannot_be_deleted(client, session, auth_headers):
    """Deleting threshold settings that fridges use is refused until they are moved."""
    fridge = add_fridge(session)
    default_id = threshold_settings(client, auth_headers)["default"]["id"]
    dairy_id = client.post("/api/v1/threshold-settings", json=DAIRY, headers=auth_headers).get_json()["id"]

    refused = client.delete(f"/api/v1/threshold-settings/{default_id}", headers=auth_headers)
    client.patch(f"/api/v1/fridges/{fridge.id}", json={"threshold_settings_id": dairy_id}, headers=auth_headers)
    deleted = client.delete(f"/api/v1/threshold-settings/{default_id}", headers=auth_headers)

    assert (refused.status_code, deleted.status_code) == (409, 204)


def test_deleting_a_fridge_keeps_its_threshold_settings(client, session, auth_headers):
    """The shared threshold settings stay for the other fridges."""
    fridge = add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")
    add_fridge(session, branch="Tel Aviv", fridge="Display 1", logger="TL-0418")

    client.delete(f"/api/v1/fridges/{fridge.id}", headers=auth_headers)

    assert threshold_settings(client, auth_headers)["default"]["fridges"] == 1
    assert session.query(ThresholdSettings).count() == 1


@pytest.mark.parametrize("method, path, body", [
    ("put", "/api/v1/threshold-settings/999", DAIRY),
    ("delete", "/api/v1/threshold-settings/999", None),
])
def test_unknown_threshold_settings_return_404(client, auth_headers, method, path, body):
    """Editing or deleting threshold settings that do not exist returns 404."""
    assert getattr(client, method)(path, json=body, headers=auth_headers).status_code == 404


def test_attaching_unknown_threshold_settings_to_a_fridge_returns_404(client, session, auth_headers):
    """A fridge cannot be moved to threshold settings that do not exist."""
    fridge = add_fridge(session)

    response = client.patch(f"/api/v1/fridges/{fridge.id}", json={"threshold_settings_id": 999}, headers=auth_headers)

    assert response.status_code == 404
