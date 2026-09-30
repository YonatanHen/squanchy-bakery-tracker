from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, ValidationInfo, field_validator
from pydantic_core import PydanticCustomError

from app.models import Metric, Status
from app.schemas.types import LoggerId
from app.services.ingest.normalizer import collapse_spaces, parse_api_time, parse_temp

Text = Annotated[str, BeforeValidator(collapse_spaces)]


class LocationFilters(BaseModel):
    """Filters shared by the readings and alerts queries; text matches ignore case."""

    branch: Text | None = None
    city: Text | None = None
    street: Text | None = None
    building_number: Text | None = None
    fridge: Text | None = None
    logger_id: Text | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    offset: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)


class ReadingFilters(LocationFilters):
    """Readings query: location, dates, and a temperature range in the given unit; archived=true lists deleted readings."""

    temp_min: float | None = None
    temp_max: float | None = None
    unit: Metric = Metric.C
    status: Status | None = None
    metric: Metric | None = None
    archived: bool = False


class ReadingPatch(BaseModel):
    """Fields the user can correct on a reading; the unit comes only from the fridge, so metric is rejected."""

    model_config = ConfigDict(extra="forbid")

    time: datetime | None = None
    temp: float | None = None
    logger_id: LoggerId | None = None

    @field_validator("logger_id")
    @classmethod
    def known_logger(cls, value: str | None, info: ValidationInfo) -> str | None:
        """Require a registered logger; the context holds the known logger ids."""
        if value is not None and value not in info.context["loggers"]:
            raise PydanticCustomError("unknown_logger", "Unknown logger")
        return value

    @field_validator("time", mode="before")
    @classmethod
    def normalized_time(cls, value: Any) -> datetime:
        """Accept the upload's date formats and the browser's YYYY-MM-DDTHH:MM."""
        return parse_api_time(value)

    @field_validator("temp", mode="before")
    @classmethod
    def normalized_temp(cls, value: Any) -> float | None:
        """A number, or ERR for no temperature."""
        return parse_temp(value)


class ReadingOut(BaseModel):
    """A reading with its original value and unit, and where it was measured."""

    id: int
    time: datetime
    temp: float | None
    metric: Metric
    status: Status
    logger_id: str
    fridge: str
    branch: str
    city: str | None
    archived_at: datetime | None = None


class ReadingPage(BaseModel):
    """One page of readings with the number of all matching readings."""

    items: list[ReadingOut]
    total: int
    offset: int
    limit: int
