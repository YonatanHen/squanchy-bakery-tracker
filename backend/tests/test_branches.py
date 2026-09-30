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
