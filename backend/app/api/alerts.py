from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.alert import AlertFilters
from app.services import alerts as alerts_service


@api_v1.get("/alerts")
def list_alerts():
    """Query alerts by location, dates and level, newest first, paginated; archived=true for deleted readings."""
    f = AlertFilters.model_validate(request.args.to_dict())
    return alerts_service.list_alerts(db.session, f).model_dump(mode="json")
