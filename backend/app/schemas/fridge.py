from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import Metric


class FridgeOut(BaseModel):
    """A fridge as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    metric: Metric
    logger_id: str | None
    avg_temp: float | None
    last_measured: datetime | None
