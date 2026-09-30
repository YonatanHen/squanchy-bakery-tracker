from app.models import Branch, Metric, Reader
from tests.helpers import load_sample


def test_sample_file_with_confirmed_registration_loads_with_expected_counts(session):
    """data/sample_week.xlsx + the user's confirmations: 15 saved, 1 duplicate, 1 ERR, Walk-in renamed, Haifa in °F."""
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
