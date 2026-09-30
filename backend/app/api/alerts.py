from flask import request

from app.api import api_v1
from app.db import db
from app.schemas.alert import AlertFilters, AlertOut
from app.services.alerts import query_alerts, query_archived_alerts


def _alert_out(alert, reader, fridge, branch) -> dict:
    """An alert row as returned by the API."""
    return AlertOut(
        id=alert.id, level=alert.level, description=alert.description, reading_id=reader.id,
        time=reader.time, temp=reader.temp, metric=reader.metric, logger_id=reader.logger_id,
        fridge=fridge.name, branch=branch.name, city=branch.city,
    ).model_dump(mode="json")


def _archived_out(alert, reader) -> dict:
    """An archived alert row; branch and fridge come from the archived reading's snapshot."""
    return AlertOut(
        id=alert.id, level=alert.level, description=alert.description, reading_id=reader.id,
        time=reader.time, temp=reader.temp, metric=reader.metric, logger_id=reader.logger_id,
        fridge=reader.fridge, branch=reader.branch, city=None, archived_at=alert.archived_at,
    ).model_dump(mode="json")


@api_v1.get("/alerts")
def list_alerts():
    """Query alerts by location, dates and level, newest first, paginated; archived=true for deleted readings."""
    f = AlertFilters.model_validate(request.args.to_dict())
    if f.archived:
        rows, total = query_archived_alerts(db.session, f)
        items = [_archived_out(*row) for row in rows]
    else:
        rows, total = query_alerts(db.session, f)
        items = [_alert_out(*row) for row in rows]
    return {"items": items, "total": total, "offset": f.offset, "limit": f.limit}
