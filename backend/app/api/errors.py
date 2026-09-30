import logging

from flask import request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import NotFound

from app.api import api_v1
from app.db import db
from app.errors import field_errors
from app.services.errors import ConflictError, NotFoundError
from app.services.ingest.parsers.base import MissingColumns, UnreadableFile, UnsupportedFormat

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


@api_v1.errorhandler(ConflictError)
def known_conflict(exc: ConflictError):
    """Return 409 with the service's message, as a field error when it names a field."""
    db.session.rollback()
    logger.warning("Rejected write: conflict on %s", exc.field or "the request")
    if exc.field:
        return {"errors": [{"field": exc.field, "message": exc.message}]}, 409
    return {"error": exc.message}, 409


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
    return {"error": "Unsupported file format. Upload an .xlsx or .csv file"}, 415


@api_v1.errorhandler(UnreadableFile)
def unreadable_file(exc: UnreadableFile):
    """Return 400 when the file's content cannot be read, with how to fix it."""
    logger.warning("Rejected upload: %s", exc)
    return {"error": "Could not read the file. Save it as CSV UTF-8 and upload it again"}, 400


@api_v1.errorhandler(MissingColumns)
def missing_columns(exc: MissingColumns):
    """Return 422 listing the required columns the file lacks."""
    return {"errors": [{"row": 1, "field": c, "message": "Missing column"} for c in exc.missing]}, 422


@api_v1.errorhandler(NotFoundError)
def missing_row(exc: NotFoundError):
    """Return 404 when a service cannot find the requested row."""
    return {"error": "Not found"}, 404
