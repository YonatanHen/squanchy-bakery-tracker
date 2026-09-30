import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Branch, Fridge, Metric


def test_branch_name_is_unique_ignoring_case(session):
    """A branch name that differs only in case is rejected."""
    session.add(Branch(name="Tel Aviv", city="Tel Aviv"))
    session.commit()

    session.add(Branch(name="tel aviv", city="Tel Aviv"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_fridge_name_is_unique_per_branch_ignoring_case(session):
    """A second "dairy" fridge in the same branch is rejected; it must get another name."""
    branch = Branch(name="Jerusalem", city="Jerusalem")
    session.add(Fridge(branch=branch, name="Dairy"))
    session.commit()

    session.add(Fridge(branch=branch, name="dairy"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_same_fridge_name_is_allowed_in_different_branches(session):
    """Jerusalem and Haifa can both have a fridge named Dairy."""
    session.add(Fridge(branch=Branch(name="Jerusalem", city="Jerusalem"), name="Dairy"))
    session.add(Fridge(branch=Branch(name="Haifa", city="Haifa"), name="Dairy"))
    session.commit()

    assert session.query(Fridge).count() == 2


def test_new_fridge_is_celsius_with_default_thresholds(session):
    """A new fridge defaults to Celsius and gets its own row of default thresholds."""
    fridge = Fridge(branch=Branch(name="Rishon LeZion", city="Rishon LeZion"), name="Cream cakes")
    session.add(fridge)
    session.commit()

    assert fridge.metric is Metric.C
    t = fridge.thresholds
    assert (t.growth_non_urgent, t.growth_urgent) == (0.1, 1.0)
    assert (t.deviation_non_urgent, t.deviation_urgent) == (1.5, 3.0)
    assert (t.gap_non_urgent_minutes, t.gap_urgent_minutes) == (15, 120)
