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
    threshold_settings_id: int
    avg_temp: float | None
    last_measured: datetime | None


class FridgePatch(BaseModel):
    """Fridge fields the user can edit; only the fields sent are changed."""

    name: Name | None = None
    metric: Metric | None = None
    logger_id: LoggerId | None = None
    threshold_settings_id: int | None = None


class DeleteImpact(BaseModel):
    """What a delete would remove; the readings and alerts are moved to the archive, not lost."""

    fridges: int
    loggers: int
    readings: int
    alerts: int
