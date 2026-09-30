from datetime import datetime

from pydantic import BaseModel

from app.models import AlertLevel, Metric
from app.schemas.reading import LocationFilters


class AlertFilters(LocationFilters):
    """Alerts query: the shared location and date filters, plus the level."""

    level: AlertLevel | None = None


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
