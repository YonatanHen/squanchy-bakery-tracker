from app.models import Metric
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
