import logging

from flask import request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import NotFound

from app.api import api_v1
from app.db import db
from app.errors import field_errors
from app.services.errors import NotFoundError
from app.services.ingest.parsers.base import MissingColumns, UnsupportedFormat

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


def unknown_url(exc: NotFound):
    """Return 404 as JSON for unknown /api/ URLs; they match no route, so the blueprint handler does not run."""
    if request.path.startswith("/api/"):
        return {"error": "Not found"}, 404
    return exc


@api_v1.errorhandler(UnsupportedFormat)
def unsupported_format(exc: UnsupportedFormat):
    """Return 415 when no parser accepts the uploaded file."""
    return {"error": "Unsupported file format. Upload an .xlsx file"}, 415


@api_v1.errorhandler(MissingColumns)
def missing_columns(exc: MissingColumns):
    """Return 422 listing the required columns the file lacks."""
    return {"errors": [{"row": 1, "field": c, "message": "Missing column"} for c in exc.missing]}, 422


@api_v1.errorhandler(NotFoundError)
def missing_row(exc: NotFoundError):
    """Return 404 when a service cannot find the requested row."""
    return {"error": "Not found"}, 404
