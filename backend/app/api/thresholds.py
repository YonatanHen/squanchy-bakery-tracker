from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.thresholds import ThresholdsIn, ThresholdsOut
from app.services import thresholds as service


def _out(settings, fridges: int) -> dict:
    """Threshold settings as returned by the API."""
    values = ThresholdsIn.model_validate(settings, from_attributes=True).model_dump()
    return ThresholdsOut(id=settings.id, fridges=fridges, **values).model_dump()


@api_v1.get("/threshold-settings")
def list_threshold_settings():
    """List the threshold settings with how many fridges use each."""
    return [_out(settings, count) for settings, count in service.list_settings(db.session)]


@api_v1.post("/threshold-settings")
def create_threshold_settings():
    """Create named threshold settings."""
    data = ThresholdsIn.model_validate(request.get_json(silent=True) or {})
    return _out(service.create_settings(db.session, data.model_dump()), 0), 201


@api_v1.put("/threshold-settings/<int:settings_id>")
def update_threshold_settings(settings_id: int):
    """Edit threshold settings; the UI confirms first because it affects every fridge using them."""
    data = ThresholdsIn.model_validate(request.get_json(silent=True) or {})
    settings = service.update_settings(db.session, settings_id, data.model_dump())
    return _out(settings, service.fridge_count(db.session, settings_id))


@api_v1.delete("/threshold-settings/<int:settings_id>")
def delete_threshold_settings(settings_id: int):
    """Delete threshold settings that no fridge uses (409 otherwise)."""
    service.delete_settings(db.session, settings_id)
    return "", 204
