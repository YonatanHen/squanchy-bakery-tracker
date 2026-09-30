from datetime import datetime

from app.models import Metric, Reader, Status
from app.services.tokens import create_token
from tests.helpers import add_fridge


def test_branch_list_requires_a_valid_token(client, app):
    """Missing, expired and forged tokens are all refused with 401."""
    expired = create_token("admin", expires_minutes=-1)

    assert client.get("/api/v1/branches").status_code == 401
    assert client.get("/api/v1/branches", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    assert client.get("/api/v1/branches", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_branch_list_shows_fridges_with_loggers_and_metric(client, session, auth_headers):
    """Haifa's Dairy fridge is listed with its logger TL-0231 and Fahrenheit metric."""
    add_fridge(session, branch="Haifa", fridge="Dairy", logger="TL-0231", metric=Metric.F)

    response = client.get("/api/v1/branches", headers=auth_headers)

    assert response.status_code == 200
    [branch] = response.get_json()
    assert branch["name"] == "Haifa"
    [fridge] = branch["fridges"]
    assert (fridge["name"], fridge["logger_id"], fridge["metric"]) == ("Dairy", "TL-0231", "F")


def test_update_branch_city_and_address(client, session, auth_headers):
    """Summer adds the address later; extra spaces are trimmed and "12a" is a valid building number."""
    fridge = add_fridge(session, branch="Jerusalem")

    response = client.patch(
        f"/api/v1/branches/{fridge.branch_id}",
        json={"city": "  Jerusalem ", "street": "Jaffa", "building_number": "12a"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.get_json()
    assert (body["name"], body["city"], body["street"], body["building_number"]) == ("Jerusalem", "Jerusalem", "Jaffa", "12a")


def test_patch_unknown_branch_returns_404(client, auth_headers):
    """Editing a branch that does not exist returns 404."""
    assert client.patch("/api/v1/branches/999", json={"city": "X"}, headers=auth_headers).status_code == 404


def test_rename_fridge_change_metric_and_logger_keeps_readings(client, session, auth_headers):
    """The TL-0417 display move: rename, switch to Fahrenheit and swap the logger; readings follow the logger."""
    fridge = add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")
    session.add(Reader(logger_id="TL-0417", time=datetime(2026, 9, 14, 6), temp=4.1, metric=Metric.C, status=Status.OK))
    session.commit()

    response = client.patch(
        f"/api/v1/fridges/{fridge.id}", json={"name": "Display 2", "metric": "F", "logger_id": "tl-0418"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert (response.get_json()["name"], response.get_json()["metric"], response.get_json()["logger_id"]) == (
        "Display 2", "F", "TL-0418",
    )
    session.expire_all()
    assert session.query(Reader).one().logger_id == "TL-0418"


def test_fridge_edit_rejects_bad_logger_id_and_empty_name(client, session, auth_headers):
    """A blank name and a logger id not matching TL-NNNN are both reported."""
    fridge = add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")

    response = client.patch(f"/api/v1/fridges/{fridge.id}", json={"name": "  ", "logger_id": "TL-51"}, headers=auth_headers)

    assert response.status_code == 422
    assert {e["field"] for e in response.get_json()["errors"]} == {"name", "logger_id"}
