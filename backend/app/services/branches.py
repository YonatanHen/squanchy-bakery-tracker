from sqlalchemy import select

from app.models import Branch


def list_branches(session) -> list[Branch]:
    """Return all branches ordered by name, with their fridges."""
    return list(session.scalars(select(Branch).order_by(Branch.name)))
