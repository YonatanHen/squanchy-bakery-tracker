from datetime import datetime

from pydantic import BaseModel

from app.models import AlertLevel, Metric
from app.schemas.reading import LocationFilters


class AlertFilters(LocationFilters):
    """Alerts query: the shared location and date filters, plus the level; archived=true lists deleted readings' alerts."""

    level: AlertLevel | None = None
    archived: bool = False


class AlertOut(BaseModel):
    """An alert with the reading it is about and where it happened."""

    id: int
    level: AlertLevel
    description: str
    reading_id: int
    time: datetime
    temp: float | None
    metric: Metric
    logger_id: str
    fridge: str
    branch: str
    city: str | None
    archived_at: datetime | None = None


class AlertPage(BaseModel):
    """One page of alerts with the number of all matching alerts."""

    items: list[AlertOut]
    total: int
    offset: int
    limit: int
