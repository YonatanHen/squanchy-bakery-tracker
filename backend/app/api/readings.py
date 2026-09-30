from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.reading import ReadingFilters, ReadingOut
from app.services.ingest.schemas import SaveResult
from app.services.ingest.service import ingest_file, ingest_record
from app.services.readings import query_readings


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


@api_v1.get("/readings")
def list_readings():
    """Query readings by location, dates and temperature range (any unit), newest last, paginated."""
    f = ReadingFilters.model_validate(request.args.to_dict())
    rows, total = query_readings(db.session, f)
    return {"items": [_reading_out(*row) for row in rows], "total": total, "offset": f.offset, "limit": f.limit}
