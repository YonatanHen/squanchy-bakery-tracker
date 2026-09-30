import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Branch


def test_branch_name_is_unique_ignoring_case(session):
    """A branch name that differs only in case is rejected."""
    session.add(Branch(name="Tel Aviv", city="Tel Aviv"))
    session.commit()

    session.add(Branch(name="tel aviv", city="Tel Aviv"))
    with pytest.raises(IntegrityError):
        session.commit()
