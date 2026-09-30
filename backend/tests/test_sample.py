from app.models import Branch, Fridge, Metric, Reader
from app.seed import seed_sample_fridges
from tests.helpers import load_sample


def test_seed_creates_the_four_known_branches_once(session):
    """Seeding twice gives the 4 known branches once; only Haifa's fridge reports in Fahrenheit."""
    seed_sample_fridges(session)
    seed_sample_fridges(session)

    assert sorted(b.name for b in session.query(Branch)) == ["Haifa", "Jerusalem", "Rishon LeZion", "Tel Aviv"]
    assert session.query(Fridge).filter_by(metric=Metric.F).one().branch.name == "Haifa"


def test_sample_week_from_the_assignment_loads_with_expected_counts(session):
    """The 16 sample rows: 15 saved, 1 duplicate, 1 ERR, Walk-in renamed, Haifa kept in °F."""
    result = load_sample(session)

    assert (result.inserted, result.duplicates, result.err_rows, result.rejected) == (15, 1, 1, 0)
    assert result.renamed_fridges == ["Tel Aviv: Walk-in -> Display 2"]
    haifa = session.query(Reader).filter_by(logger_id="TL-0231").order_by(Reader.time).all()
    assert [(r.temp, r.metric) for r in haifa] == [(38.3, Metric.F), (39.0, Metric.F), (None, Metric.F)]
