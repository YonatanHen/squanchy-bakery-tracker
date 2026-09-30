from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import Metric
from app.schemas.types import LoggerId, Name


class FridgeOut(BaseModel):
    """A fridge as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    metric: Metric
    logger_id: str | None
    avg_temp: float | None
    last_measured: datetime | None


class FridgePatch(BaseModel):
    """Fridge fields Summer can edit; only the fields sent are changed."""

    name: Name | None = None
    metric: Metric | None = None
    logger_id: LoggerId | None = None
