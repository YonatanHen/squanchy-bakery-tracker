from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.fridge import FridgeOut, FridgePatch
from app.services import fridges as service


@api_v1.patch("/fridges/<int:fridge_id>")
def update_fridge(fridge_id: int):
    """Edit a fridge's name, metric or logger."""
    data = FridgePatch.model_validate(request.get_json(silent=True) or {})
    fridge = service.update_fridge(db.session, fridge_id, data.model_dump(exclude_unset=True))
    return FridgeOut.model_validate(fridge).model_dump(mode="json")
