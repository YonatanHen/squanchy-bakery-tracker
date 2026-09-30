import pytest

from app.models import Logger
from tests.helpers import load_sample


@pytest.fixture
def sample(session):
    """The sample week, loaded from the real file (5 alerts)."""
    load_sample(session)


def query(client, headers, **params):
    """GET /alerts with the filters; must succeed."""
    response = client.get("/api/v1/alerts", query_string=params, headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def test_all_alerts_of_the_sample_week_newest_first(client, auth_headers, sample):
    """All 5 alerts are listed, the newest reading first."""
    result = query(client, auth_headers)

    assert result["total"] == 5
    assert result["items"][0]["time"] == "2026-09-17T06:00:00"


def test_filter_by_level(client, auth_headers, sample):
    """3 of the 5 alerts are urgent."""
    assert query(client, auth_headers, level="URGENT")["total"] == 3


def test_filter_by_branch_and_date(client, auth_headers, sample):
    """Rishon has 2 alerts; from 17/09 there is only Display 2's urgent gap."""
    assert query(client, auth_headers, branch="rishon lezion")["total"] == 2
    [alert] = query(client, auth_headers, date_from="2026-09-17T00:00")["items"]
    assert (alert["fridge"], alert["level"]) == ("Display 2", "URGENT")


def test_alerts_of_a_deleted_fridge_are_listed_as_archived(client, session, auth_headers, sample):
    """After Rishon's fridge is deleted, its 2 alerts can still be shown to the inspector."""
    fridge = session.get(Logger, "TL-0388").fridge
    client.delete(f"/api/v1/fridges/{fridge.id}", headers=auth_headers)

    archived = query(client, auth_headers, archived="true")

    assert query(client, auth_headers)["total"] == 3
    assert archived["total"] == 2
    assert {(a["branch"], a["fridge"]) for a in archived["items"]} == {("Rishon LeZion", "Cream cakes")}
    assert all(a["archived_at"] for a in archived["items"])
