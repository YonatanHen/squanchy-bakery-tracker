from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.branch import BranchOut, BranchPatch
from app.services import branches as service


@api_v1.get("/branches")
def list_branches():
    """List branches with their fridges and loggers."""
    return [BranchOut.model_validate(b).model_dump(mode="json") for b in service.list_branches(db.session)]


@api_v1.patch("/branches/<int:branch_id>")
def update_branch(branch_id: int):
    """Edit a branch's name, city or address."""
    data = BranchPatch.model_validate(request.get_json(silent=True) or {})
    branch = service.update_branch(db.session, branch_id, data.model_dump(exclude_unset=True))
    return BranchOut.model_validate(branch).model_dump(mode="json")
