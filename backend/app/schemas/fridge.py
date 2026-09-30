from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

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
    last_measured: datetime | None


class FridgePatch(BaseModel):
    """Fridge fields the user can edit; only the fields sent are changed."""

    name: Name | None = None
    metric: Metric | None = None
    logger_id: LoggerId | None = None
    threshold_settings_id: int | None = None

    @field_validator("*", mode="before")
    @classmethod
    def not_null(cls, value: Any) -> Any:
        """Reject an explicit null; a field that is not sent stays unchanged."""
        if value is None:
            raise ValueError("Cannot be empty")
        return value


class DeleteImpact(BaseModel):
    """What a delete would remove; the readings and alerts are moved to the archive, not lost."""

    fridges: int
    loggers: int
    readings: int
    alerts: int
