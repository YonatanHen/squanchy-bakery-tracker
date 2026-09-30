import io
import json

from app.models import Branch, Fridge, Metric, Reader
from tests.helpers import add_fridge, xlsx_bytes

HEADER = ["Logger", "Branch", "Fridge", "Time", "Temp"]

EILAT = {
    "branches": [{"name": "Eilat", "city": "Eilat"}],
    "fridges": [{"logger_id": "TL-0600", "branch": "eilat", "fridge": "Dairy", "metric": "F"}],
}


def upload(client, headers, rows, filename="week.xlsx", header=HEADER, register=None):
    """Upload an .xlsx built from the rows, with an optional register block of confirmed new entities."""
    data = {"file": (io.BytesIO(xlsx_bytes(header, rows)), filename)}
    if register is not None:
        data["register"] = json.dumps(register)
    return client.post("/api/v1/readings/upload", data=data, headers=headers, content_type="multipart/form-data")


def test_valid_upload_saves_readings_and_reports_counts(client, session, auth_headers):
    """A valid file is saved and the result reports inserted and ERR counts."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")

    response = upload(client, auth_headers, [
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8],
        ["TL-0512", "jerusalem", "Dairy", "2026-09-14 06:15", "ERR"],
    ])

    assert response.status_code == 201
    assert response.get_json() == {
        "inserted": 2, "duplicates": 0, "err_rows": 1, "rejected": 0, "renamed_fridges": [], "alerts": 0, "errors": [],
        "fridge_name_mismatches": [],
    }


def test_valid_rows_are_saved_and_invalid_rows_are_reported(client, session, auth_headers):
    """Good rows are saved; bad rows are skipped and listed with their file row so the user can fix them."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")

    response = upload(client, auth_headers, [
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8],
        ["TL-0512", "Eilat", "Dairy", "2026-09-14 06:15", 3.9],
        ["TL-0512", "Jerusalem", "Dairy", "32/09/2026 06:30", 4.0],
        ["TL-51", "Jerusalem", "Dairy", "2026-09-14 06:45", 4.0],
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 07:00", 4.1],
    ])

    assert response.status_code == 201
    body = response.get_json()
    assert (body["inserted"], body["rejected"]) == (2, 3)
    assert [(e["row"], e["field"]) for e in body["errors"]] == [(3, "branch"), (4, "time"), (5, "logger")]
    assert session.query(Reader).count() == 2


def test_reupload_after_fixing_a_row_adds_only_that_row(client, session, auth_headers):
    """After the user fixes the bad date, re-uploading the file skips the saved row and adds the fixed one."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    good = ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8]

    first = upload(client, auth_headers, [good, ["TL-0512", "Jerusalem", "Dairy", "32/09/2026 06:15", 3.9]]).get_json()
    second = upload(client, auth_headers, [good, ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:15", 3.9]]).get_json()

    assert (first["inserted"], first["rejected"]) == (1, 1)
    assert (second["inserted"], second["duplicates"], second["rejected"]) == (1, 1, 0)
    assert session.query(Reader).count() == 2


def test_duplicates_in_the_file_and_in_the_database_are_skipped(client, session, auth_headers):
    """The same logger and time twice keeps the first row; re-uploading skips everything already saved."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    rows = [
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:15", 3.9],
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:15", 4.2],
    ]

    first = upload(client, auth_headers, rows).get_json()
    second = upload(client, auth_headers, rows).get_json()

    assert (first["inserted"], first["duplicates"]) == (1, 1)
    assert (second["inserted"], second["duplicates"]) == (0, 2)
    assert session.query(Reader).one().temp == 3.9


def test_known_logger_with_a_new_fridge_name_renames_the_fridge(client, session, auth_headers):
    """TL-0417 reporting as "Display 2" renames Walk-in, and the result says so."""
    add_fridge(session, branch="Tel Aviv", fridge="Walk-in", logger="TL-0417")

    response = upload(client, auth_headers, [
        ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 06:00", 4.1],
        ["TL-0417", "tel aviv", "Display 2", "2026-09-17 06:00", 3.7],
    ])

    assert response.get_json()["renamed_fridges"] == ["Tel Aviv: Walk-in -> Display 2"]
    session.expire_all()
    assert session.query(Fridge).one().name == "Display 2"


def test_fridge_name_typo_in_an_older_row_is_reported(client, session, auth_headers):
    """Rows Dairy / Diary / Dairy: all 3 are saved, and the user sees the mismatch."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")

    response = upload(client, auth_headers, [
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8],
        ["TL-0512", "Jerusalem", "Diary", "2026-09-14 06:15", 3.9],
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:30", 4.0],
    ])

    body = response.get_json()
    assert (body["inserted"], body["renamed_fridges"]) == (3, [])
    assert body["fridge_name_mismatches"] == [{"row": 3, "logger": "TL-0512", "name_in_file": "Diary", "fridge": "Dairy"}]


def test_header_only_sheet_saves_nothing(client, session, auth_headers):
    """A sheet with only the header row is accepted with 0 inserted."""
    response = upload(client, auth_headers, [])

    assert response.status_code == 201
    assert response.get_json()["inserted"] == 0


def test_unknown_branch_and_loggers_are_grouped_for_confirmation(client, session, auth_headers):
    """Rows of unknown branches and loggers are skipped and listed once each, for "did you mean / add it?"."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")

    response = upload(client, auth_headers, [
        ["TL-0600", "Eilat", "Dairy", "2026-09-14 06:00", 3.8],
        ["TL-0600", "Eilat", "Dairy", "2026-09-14 06:15", 3.9],
        ["TL-0601", "jerusalem", "Freezer", "2026-09-14 06:00", -18.0],
        ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8],
    ])

    assert response.status_code == 201
    body = response.get_json()
    assert (body["inserted"], body["rejected"]) == (1, 3)
    assert body["unknown"] == {
        "branches": [{"name": "Eilat", "suggestion": None}],
        "loggers": [
            {"logger": "TL-0600", "branch": "Eilat", "fridge": "Dairy"},
            {"logger": "TL-0601", "branch": "Jerusalem", "fridge": "Freezer"},
        ],
    }


def test_branch_typo_gets_a_did_you_mean_suggestion(client, session, auth_headers):
    """A misspelled branch is suggested as the registered one, never created silently."""
    add_fridge(session, branch="Rishon LeZion", fridge="Cream cakes", logger="TL-0388")

    response = upload(client, auth_headers, [["TL-0388", "Rishon LeZoin", "Cream cakes", "2026-09-14 06:00", 4.6]])

    assert response.get_json()["unknown"]["branches"] == [{"name": "Rishon LeZoin", "suggestion": "Rishon LeZion"}]


def test_confirmed_new_branch_fridge_and_logger_are_saved_with_the_readings(client, session, auth_headers):
    """After the user confirms, Eilat, its Dairy fridge and logger TL-0600 (°F) are created and the row is saved."""
    response = upload(client, auth_headers, [["TL-0600", "Eilat", "Dairy", "2026-09-14 06:00", 38.3]], register=EILAT)

    assert response.status_code == 201
    fridge = session.query(Fridge).one()
    assert (fridge.branch.name, fridge.branch.city, fridge.branch.street, fridge.name, fridge.metric) == (
        "Eilat", "Eilat", None, "Dairy", Metric.F,
    )
    assert session.query(Reader).one().metric == Metric.F


def test_registration_is_kept_when_another_row_is_still_invalid(client, session, auth_headers):
    """A bad row in the file does not undo the confirmed registration or the valid rows."""
    rows = [
        ["TL-0600", "Eilat", "Dairy", "2026-09-14 06:00", 38.3],
        ["TL-0600", "Eilat", "Dairy", "32/09/2026 06:15", 38.5],
    ]

    response = upload(client, auth_headers, rows, register=EILAT)

    assert response.status_code == 201
    assert (response.get_json()["inserted"], response.get_json()["rejected"]) == (1, 1)
    assert (session.query(Branch).count(), session.query(Fridge).count()) == (1, 1)


def test_resending_the_same_registration_is_ignored(client, session, auth_headers):
    """A register block that was already applied is skipped; the rows are saved as usual."""
    upload(client, auth_headers, [["TL-0600", "Eilat", "Dairy", "2026-09-14 06:00", 38.3]], register=EILAT)

    second = upload(client, auth_headers, [["TL-0600", "Eilat", "Dairy", "2026-09-14 06:15", 38.4]], register=EILAT)

    assert second.status_code == 201
    assert second.get_json()["inserted"] == 1
    assert session.query(Branch).count() == 1


def test_new_logger_for_a_fridge_that_has_one_is_a_clear_422(client, session, auth_headers):
    """Registering TL-0600 for Jerusalem's Dairy (which has TL-0512) asks the user to edit the fridge instead."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    register = {"fridges": [{"logger_id": "TL-0600", "branch": "Jerusalem", "fridge": "Dairy"}]}

    response = upload(client, auth_headers, [["TL-0600", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8]], register=register)

    assert response.status_code == 422
    assert response.get_json()["errors"][0]["message"] == (
        "Fridge 'Dairy' in Jerusalem already has logger TL-0512; edit the fridge's logger instead"
    )
    assert session.query(Reader).count() == 0


def test_registering_a_logger_that_belongs_to_another_fridge_is_a_clear_422(client, session, auth_headers):
    """TL-0512 is already Jerusalem's Dairy logger; registering it for Tel Aviv Walk-in is refused."""
    add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512")
    add_fridge(session, branch="Tel Aviv", fridge="Display 1", logger="TL-0418")
    register = {"fridges": [{"logger_id": "TL-0512", "branch": "Tel Aviv", "fridge": "Walk-in"}]}

    response = upload(client, auth_headers, [["TL-0512", "Tel Aviv", "Walk-in", "2026-09-14 06:00", 4.1]], register=register)

    assert response.status_code == 422
    assert response.get_json()["errors"][0]["message"] == "Logger TL-0512 already belongs to Jerusalem / Dairy"


def test_new_fridge_needs_a_known_or_confirmed_branch(client, auth_headers):
    """An invalid register block rejects the request, since it is the user's own form."""
    register = {"fridges": [{"logger_id": "TL-0600", "branch": "Eilat", "fridge": "Dairy"}]}

    response = upload(client, auth_headers, [["TL-0600", "Eilat", "Dairy", "2026-09-14 06:00", 3.8]], register=register)

    assert response.status_code == 422
    assert response.get_json()["errors"][0]["message"] == "Branch 'Eilat' does not exist. Add it to branches"


def test_missing_columns_and_unsupported_files_are_rejected(client, auth_headers):
    """Missing columns give 422; a format with no parser (.txt) gives 415."""
    assert upload(client, auth_headers, [], header=["Time", "Temp"]).status_code == 422
    txt = {"file": (io.BytesIO(b"Logger,Branch\n"), "week.txt")}
    response = client.post("/api/v1/readings/upload", data=txt, headers=auth_headers, content_type="multipart/form-data")
    assert response.status_code == 415
