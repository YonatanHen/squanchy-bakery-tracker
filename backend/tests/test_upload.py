import io

from app.models import Fridge, Reader
from tests.helpers import add_fridge, xlsx_bytes

HEADER = ["Logger", "Branch", "Fridge", "Time", "Temp"]


def upload(client, headers, rows, filename="week.xlsx", header=HEADER):
    """Upload an .xlsx built from the rows."""
    data = {"file": (io.BytesIO(xlsx_bytes(header, rows)), filename)}
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


def test_header_only_sheet_saves_nothing(client, session, auth_headers):
    """A sheet with only the header row is accepted with 0 inserted."""
    response = upload(client, auth_headers, [])

    assert response.status_code == 201
    assert response.get_json()["inserted"] == 0


def test_missing_columns_and_unsupported_files_are_rejected(client, auth_headers):
    """Missing columns give 422; a CSV gives 415."""
    assert upload(client, auth_headers, [], header=["Time", "Temp"]).status_code == 422
    csv = {"file": (io.BytesIO(b"Logger,Branch\n"), "week.csv")}
    response = client.post("/api/v1/readings/upload", data=csv, headers=auth_headers, content_type="multipart/form-data")
    assert response.status_code == 415
