import logging

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.api import api_v1
from app.db import db
from app.errors import field_errors
from app.services.errors import NotFoundError

logger = logging.getLogger(__name__)


@api_v1.errorhandler(ValidationError)
def validation_failed(exc: ValidationError):
    """Return 422 with one entry per invalid field."""
    errors = field_errors(exc)
    logger.warning("Rejected request: %d invalid fields (%s)", len(errors), ", ".join(e.field for e in errors))
    return {"errors": [e.model_dump(exclude_none=True) for e in errors]}, 422


@api_v1.errorhandler(IntegrityError)
def conflict(exc: IntegrityError):
    """Return 409 when a write breaks a unique or foreign key constraint."""
    db.session.rollback()
    logger.warning("Rejected write: conflicts with existing data")
    return {"error": "Conflicts with existing data (duplicate name, logger id or reading time)"}, 409


@api_v1.errorhandler(404)
def not_found(exc):
    """Return 404 as JSON."""
    return {"error": "Not found"}, 404


@api_v1.errorhandler(NotFoundError)
def missing_row(exc: NotFoundError):
    """Return 404 when a service cannot find the requested row."""
    return {"error": "Not found"}, 404
