from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.thresholds import ThresholdsIn, ThresholdsOut
from app.services import thresholds as service


def _out(profile, fridges: int) -> dict:
    """A profile as returned by the API."""
    values = ThresholdsIn.model_validate(profile, from_attributes=True).model_dump()
    return ThresholdsOut(id=profile.id, fridges=fridges, **values).model_dump()


@api_v1.get("/threshold-settings")
def list_threshold_settings():
    """List profiles with how many fridges use each."""
    return [_out(profile, count) for profile, count in service.list_profiles(db.session)]


@api_v1.post("/threshold-settings")
def create_threshold_settings():
    """Create a named threshold profile."""
    data = ThresholdsIn.model_validate(request.get_json(silent=True) or {})
    return _out(service.create_profile(db.session, data.model_dump()), 0), 201


@api_v1.put("/threshold-settings/<int:profile_id>")
def update_threshold_settings(profile_id: int):
    """Edit a profile; the UI confirms first because it affects every fridge using it."""
    data = ThresholdsIn.model_validate(request.get_json(silent=True) or {})
    profile = service.update_profile(db.session, profile_id, data.model_dump())
    return _out(profile, service.fridge_count(db.session, profile_id))


@api_v1.delete("/threshold-settings/<int:profile_id>")
def delete_threshold_settings(profile_id: int):
    """Delete a profile that no fridge uses (409 otherwise)."""
    service.delete_profile(db.session, profile_id)
    return "", 204
