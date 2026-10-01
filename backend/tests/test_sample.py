import io
import json

import pytest

from app.models import Branch, Metric, Reader
from tests.helpers import SAMPLE_FILE, SAMPLE_REGISTRATION, load_sample, sample_as_csv


def test_sample_file_with_confirmed_registration_loads_with_expected_counts(session):
    """data/dummy_upload.xlsx + the user's confirmations: 15 saved, 1 duplicate, 1 ERR, Walk-in renamed, Haifa in °F."""
    result = load_sample(session)

    assert (result.inserted, result.duplicates, result.err_rows, result.rejected) == (15, 1, 1, 0)
    assert result.renamed_fridges == ["Tel Aviv: Walk-in -> Display 2"]
    assert sorted(b.name for b in session.query(Branch)) == ["Haifa", "Jerusalem", "Rishon LeZion", "Tel Aviv"]
    haifa = session.query(Reader).filter_by(logger_id="TL-0231").order_by(Reader.time).all()
    assert [(r.temp, r.metric) for r in haifa] == [(38.3, Metric.F), (39.0, Metric.F), (None, Metric.F)]


def test_sample_file_without_registration_lists_all_four_branches_as_unknown(session):
    """On an empty database the real file saves nothing and asks the user to add the 4 branches and 4 loggers."""
    result = load_sample(session, register=None)

    assert (result.inserted, result.rejected) == (0, 16)
    assert sorted(b.name for b in result.unknown.branches) == ["Haifa", "Jerusalem", "Rishon LeZion", "Tel Aviv"]
    assert len(result.unknown.loggers) == 4


@pytest.mark.parametrize("filename, content", [
    ("dummy_upload.xlsx", lambda: SAMPLE_FILE.read_bytes()),
    ("dummy_upload.csv", sample_as_csv),
])
def test_sample_rows_uploaded_as_csv_give_the_same_counts_as_xlsx(client, auth_headers, filename, content):
    """The sample rows saved as CSV give the same inserted, duplicate, ERR and alert counts as the .xlsx file."""
    data = {"file": (io.BytesIO(content()), filename), "register": json.dumps(SAMPLE_REGISTRATION)}
    response = client.post("/api/v1/readings/upload", data=data, headers=auth_headers, content_type="multipart/form-data")

    body = response.get_json()
    assert response.status_code == 201
    assert (body["inserted"], body["duplicates"], body["err_rows"], body["rejected"], body["alerts"]) == (15, 1, 1, 0, 5)
