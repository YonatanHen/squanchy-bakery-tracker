import logging

from app.models import Fridge, Logger
from app.services.errors import get_or_raise

logger = logging.getLogger(__name__)


def update_fridge(session, fridge_id: int, changes: dict) -> Fridge:
    """Apply field changes to a fridge; a new logger id replaces its logger and its readings follow.

    Args:
        session: The SQLAlchemy session.
        fridge_id: The fridge to edit; NotFoundError if it does not exist.
        changes: Validated values for name, metric and/or logger_id.

    Returns:
        The updated fridge.
    """
    fridge = get_or_raise(session, Fridge, fridge_id)
    changes = dict(changes)
    if "logger_id" in changes:
        new_id = changes.pop("logger_id")
        if fridge.logger:
            fridge.logger.id = new_id  # ON UPDATE CASCADE moves the readings to the new id
        else:
            fridge.logger = Logger(id=new_id)
    for field, value in changes.items():
        setattr(fridge, field, value)
    session.commit()
    logger.info("Updated fridge id=%s", fridge_id)
    return fridge
