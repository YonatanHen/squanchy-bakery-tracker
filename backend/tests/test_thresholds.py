import pytest

from app.models import ThresholdSettings
from tests.helpers import add_fridge

DAIRY = {
    "name": "Dairy",
    "growth_non_urgent": 0.2, "growth_urgent": 1.5,
    "deviation_non_urgent": 1.0, "deviation_urgent": 2.0,
    "gap_non_urgent_minutes": 20, "gap_urgent_minutes": 90,
}


def profiles(client, headers) -> dict[str, dict]:
    """GET /threshold-settings keyed by profile name."""
    response = client.get("/api/v1/threshold-settings", headers=headers)
    assert response.status_code == 200
    return {p["name"]: p for p in response.get_json()}


def test_list_profiles_with_how_many_fridges_use_each(client, session, auth_headers):
    """The user sees each profile's values and how many fridges it affects."""
    add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")
    add_fridge(session, branch="Tel Aviv", fridge="Display 1", logger="TL-0418")

    default = profiles(client, auth_headers)["default"]

    assert (default["fridges"], default["growth_urgent"], default["gap_urgent_minutes"]) == (2, 1.0, 120)


def test_create_a_profile_and_attach_a_fridge_to_it(client, session, auth_headers):
    """A "Dairy" profile is created and one fridge is moved to it."""
    fridge = add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    add_fridge(session, branch="Jerusalem", fridge="Freezer", logger="TL-0513")

    created = client.post("/api/v1/threshold-settings", json=DAIRY, headers=auth_headers)
    moved = client.patch(
        f"/api/v1/fridges/{fridge.id}", json={"threshold_settings_id": created.get_json()["id"]}, headers=auth_headers
    )

    assert created.status_code == 201
    assert moved.status_code == 200
    counts = {name: p["fridges"] for name, p in profiles(client, auth_headers).items()}
    assert counts == {"default": 1, "Dairy": 1}


def test_edit_profile_rejects_non_urgent_above_urgent(client, session, auth_headers):
    """A non-urgent limit must be below its urgent limit; a valid edit is saved."""
    add_fridge(session)
    profile_id = profiles(client, auth_headers)["default"]["id"]
    url = f"/api/v1/threshold-settings/{profile_id}"

    bad = client.put(url, json={**DAIRY, "name": "default", "growth_non_urgent": 2.0, "growth_urgent": 1.0}, headers=auth_headers)
    good = client.put(url, json={**DAIRY, "name": "default", "deviation_non_urgent": 1.2}, headers=auth_headers)

    assert bad.status_code == 422
    assert good.status_code == 200
    assert good.get_json()["deviation_non_urgent"] == 1.2


def test_profile_in_use_cannot_be_deleted(client, session, auth_headers):
    """Deleting a profile that fridges use is refused until they are moved."""
    fridge = add_fridge(session)
    default_id = profiles(client, auth_headers)["default"]["id"]
    dairy_id = client.post("/api/v1/threshold-settings", json=DAIRY, headers=auth_headers).get_json()["id"]

    refused = client.delete(f"/api/v1/threshold-settings/{default_id}", headers=auth_headers)
    client.patch(f"/api/v1/fridges/{fridge.id}", json={"threshold_settings_id": dairy_id}, headers=auth_headers)
    deleted = client.delete(f"/api/v1/threshold-settings/{default_id}", headers=auth_headers)

    assert (refused.status_code, deleted.status_code) == (409, 204)


def test_deleting_a_fridge_keeps_its_profile(client, session, auth_headers):
    """The shared profile stays for the other fridges."""
    fridge = add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")
    add_fridge(session, branch="Tel Aviv", fridge="Display 1", logger="TL-0418")

    client.delete(f"/api/v1/fridges/{fridge.id}", headers=auth_headers)

    assert profiles(client, auth_headers)["default"]["fridges"] == 1
    assert session.query(ThresholdSettings).count() == 1


@pytest.mark.parametrize("method, path, body", [
    ("put", "/api/v1/threshold-settings/999", DAIRY),
    ("delete", "/api/v1/threshold-settings/999", None),
])
def test_unknown_profile_returns_404(client, auth_headers, method, path, body):
    """Editing or deleting a profile that does not exist returns 404."""
    assert getattr(client, method)(path, json=body, headers=auth_headers).status_code == 404


def test_attaching_an_unknown_profile_to_a_fridge_returns_404(client, session, auth_headers):
    """A fridge cannot be moved to a profile that does not exist."""
    fridge = add_fridge(session)

    response = client.patch(f"/api/v1/fridges/{fridge.id}", json={"threshold_settings_id": 999}, headers=auth_headers)

    assert response.status_code == 404
