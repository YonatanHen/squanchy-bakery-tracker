from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.fridge import DeleteImpact, FridgeOut, FridgePatch
from app.services import fridges as service


@api_v1.patch("/fridges/<int:fridge_id>")
def update_fridge(fridge_id: int):
    """Edit a fridge's name, metric or logger."""
    data = FridgePatch.model_validate(request.get_json(silent=True) or {})
    fridge = service.update_fridge(db.session, fridge_id, data.model_dump(exclude_unset=True))
    return FridgeOut.model_validate(fridge).model_dump(mode="json")


@api_v1.get("/fridges/<int:fridge_id>/delete-impact")
def fridge_delete_impact(fridge_id: int):
    """Counts for the delete confirmation dialog; deletes nothing."""
    return DeleteImpact.model_validate(service.fridge_delete_impact(db.session, fridge_id)).model_dump()


@api_v1.delete("/fridges/<int:fridge_id>")
def delete_fridge(fridge_id: int):
    """Delete a fridge and its logger; its readings and alerts are archived."""
    service.delete_fridge(db.session, fridge_id)
    return "", 204
