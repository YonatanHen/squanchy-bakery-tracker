from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.reading import ReadingFilters
from app.services import archive as archive_service
from app.services import readings as readings_service
from app.services.ingest.schemas import SaveResult
from app.services.ingest.service import ingest_file, ingest_record


def _body(result: SaveResult) -> dict:
    """Response body of an ingest; "unknown" only when something is unknown."""
    return result.model_dump(exclude={"unknown"} if result.unknown is None else None)


@api_v1.post("/readings/upload")
def upload_readings():
    """Upload an .xlsx file; valid rows are saved and invalid rows are returned to fix."""
    file = request.files.get("file")
    if file is None or not file.filename:
        return {"error": "No file uploaded"}, 400
    return _body(ingest_file(db.session, file.filename, file.read(), request.form.get("register"))), 201


@api_v1.post("/readings")
def add_reading():
    """Add one reading; 422 with its field errors when it is rejected."""
    body = request.get_json(silent=True)
    result = ingest_record(db.session, body if isinstance(body, dict) else {})
    return _body(result), 422 if result.rejected else 201


@api_v1.get("/readings")
def list_readings():
    """Query readings by location, dates and temperature range (any unit), paginated; archived=true for deleted ones."""
    f = ReadingFilters.model_validate(request.args.to_dict())
    return readings_service.list_readings(db.session, f).model_dump(mode="json")


@api_v1.patch("/readings/<int:reading_id>")
def update_reading(reading_id: int):
    """Correct a reading's logger, time or temperature in place; the unit follows the fridge."""
    body = request.get_json(silent=True) or {}
    return readings_service.edit_reading(db.session, reading_id, body).model_dump(mode="json")


@api_v1.delete("/readings/archive")
def clean_archive():
    """Delete all archived readings and their alerts for good; returns the counts."""
    return archive_service.clean_archive(db.session).model_dump()


@api_v1.delete("/readings/<int:reading_id>")
def delete_reading(reading_id: int):
    """Delete a reading; it is archived with its alerts."""
    readings_service.delete_reading(db.session, reading_id)
    return "", 204
