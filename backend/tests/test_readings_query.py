import pytest

from tests.helpers import load_sample


@pytest.fixture
def sample(session):
    """The sample week, loaded from the real file."""
    load_sample(session)


def query(client, headers, **params):
    """GET /readings with the filters; must succeed."""
    response = client.get("/api/v1/readings", query_string=params, headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def test_inspector_question_above_any_threshold_for_a_fridge(client, auth_headers, sample):
    """"When did Cream cakes go above X degrees?" works for any X, e.g. 5 and 5.5."""
    above_5 = query(client, auth_headers, fridge="cream cakes", temp_min=5)
    above_5_5 = query(client, auth_headers, fridge="Cream cakes", temp_min=5.5)

    assert [r["time"] for r in above_5["items"]] == ["2026-09-14T06:15:00", "2026-09-14T06:30:00", "2026-09-14T06:45:00"]
    assert [r["time"] for r in above_5_5["items"]] == ["2026-09-14T06:30:00", "2026-09-14T06:45:00"]


def test_temperature_filter_in_celsius_converts_the_fahrenheit_fridge(client, auth_headers, sample):
    """temp_max=4 (°C) matches Haifa's 38.3°F and 39.0°F, returned in their original unit."""
    result = query(client, auth_headers, branch="haifa", temp_max=4)

    assert [(r["temp"], r["metric"]) for r in result["items"]] == [(38.3, "F"), (39.0, "F")]


def test_city_and_date_range(client, auth_headers, sample):
    """Tel Aviv from 17/09 is only Display 2's 3.7°C."""
    result = query(client, auth_headers, city="Tel Aviv", date_from="2026-09-17T00:00")

    assert [(r["fridge"], r["temp"]) for r in result["items"]] == [("Display 2", 3.7)]


def test_pagination_reports_the_total(client, auth_headers, sample):
    """offset/limit page through the 15 readings and report the total."""
    result = query(client, auth_headers, offset=10, limit=5)

    assert (len(result["items"]), result["total"]) == (5, 15)


def test_invalid_filter_values_return_422(client, auth_headers):
    """A zero limit and an unknown status are reported per field."""
    response = client.get("/api/v1/readings", query_string={"limit": 0, "status": "BROKEN"}, headers=auth_headers)

    assert response.status_code == 422
    assert {e["field"] for e in response.get_json()["errors"]} == {"limit", "status"}
