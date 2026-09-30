from app.api import api_v1
from app.db import db
from app.schemas.branch import BranchOut
from app.services import branches as service


@api_v1.get("/branches")
def list_branches():
    """List branches with their fridges and loggers."""
    return [BranchOut.model_validate(b).model_dump(mode="json") for b in service.list_branches(db.session)]
