from flask import request

from app.api import api_v1
from app.db import db
from app.services.ingest.service import ingest_file


@api_v1.post("/readings/upload")
def upload_readings():
    """Upload an .xlsx file; valid rows are saved and invalid rows are returned to fix."""
    file = request.files.get("file")
    if file is None or not file.filename:
        return {"error": "No file uploaded"}, 400
    return ingest_file(db.session, file.filename, file.read()).model_dump(exclude_none=True), 201
