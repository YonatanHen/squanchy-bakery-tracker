from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

from app.models import Metric, Status
from app.services.ingest.normalizer import collapse_spaces

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
    """Readings query: location, dates, and a temperature range in the given unit."""

    temp_min: float | None = None
    temp_max: float | None = None
    unit: Metric = Metric.C
    status: Status | None = None
    metric: Metric | None = None


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
