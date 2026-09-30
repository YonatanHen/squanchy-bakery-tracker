from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.reading import ReadingFilters, ReadingOut, ReadingPatch
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


def _reading_out(reader, fridge, branch) -> dict:
    """A reading row as returned by the API."""
    return ReadingOut(
        id=reader.id, time=reader.time, temp=reader.temp, metric=reader.metric, status=reader.status,
        logger_id=reader.logger_id, fridge=fridge.name, branch=branch.name, city=branch.city,
    ).model_dump(mode="json")


def _archived_out(reader) -> dict:
    """An archived reading row; branch and fridge come from its snapshot."""
    return ReadingOut(
        id=reader.id, time=reader.time, temp=reader.temp, metric=reader.metric, status=reader.status,
        logger_id=reader.logger_id, fridge=reader.fridge, branch=reader.branch, city=None, archived_at=reader.archived_at,
    ).model_dump(mode="json")


@api_v1.get("/readings")
def list_readings():
    """Query readings by location, dates and temperature range (any unit), paginated; archived=true for deleted ones."""
    f = ReadingFilters.model_validate(request.args.to_dict())
    if f.archived:
        rows, total = readings_service.query_archived_readings(db.session, f)
        items = [_archived_out(row) for row in rows]
    else:
        rows, total = readings_service.query_readings(db.session, f)
        items = [_reading_out(*row) for row in rows]
    return {"items": items, "total": total, "offset": f.offset, "limit": f.limit}


@api_v1.patch("/readings/<int:reading_id>")
def update_reading(reading_id: int):
    """Correct a reading's logger, time, temperature or unit in place."""
    changes = ReadingPatch.model_validate(request.get_json(silent=True) or {}).model_dump(exclude_unset=True)
    reader = readings_service.update_reading(db.session, reading_id, changes)
    fridge = reader.logger.fridge
    return _reading_out(reader, fridge, fridge.branch)


@api_v1.delete("/readings/<int:reading_id>")
def delete_reading(reading_id: int):
    """Delete a reading; it is archived with its alerts."""
    readings_service.delete_reading(db.session, reading_id)
    return "", 204
