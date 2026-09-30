import logging

from sqlalchemy import select

from app.models import Branch, Fridge
from app.services.errors import get_or_raise
from app.services.fridges import count_impact

logger = logging.getLogger(__name__)


def list_branches(session) -> list[Branch]:
    """Return all branches ordered by name, with their fridges."""
    return list(session.scalars(select(Branch).order_by(Branch.name)))


def update_branch(session, branch_id: int, changes: dict) -> Branch:
    """Apply the given field changes to a branch.

    Args:
        session: The SQLAlchemy session.
        branch_id: The branch to edit; NotFoundError if it does not exist.
        changes: Validated field values to set.

    Returns:
        The updated branch.
    """
    branch = get_or_raise(session, Branch, branch_id)
    for field, value in changes.items():
        setattr(branch, field, value)
    session.commit()
    logger.info("Updated branch id=%s fields=%s", branch_id, sorted(changes))
    return branch


def branch_delete_impact(session, branch_id: int) -> dict[str, int]:
    """Counts of what deleting this branch would remove or archive; deletes nothing."""
    get_or_raise(session, Branch, branch_id)
    return count_impact(session, Fridge.branch_id == branch_id)


def delete_branch(session, branch_id: int) -> None:
    """Delete a branch with its fridges and loggers; their readings and alerts go to the archive."""
    session.delete(get_or_raise(session, Branch, branch_id))
    session.commit()
    logger.info("Deleted branch id=%s", branch_id)
