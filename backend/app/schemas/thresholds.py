from pydantic import BaseModel, Field, ValidationError, model_validator
from pydantic_core import InitErrorDetails, PydanticCustomError

from app.schemas.types import Name

PAIRS = (
    ("growth_non_urgent", "growth_urgent", "Must be lower than the urgent limit"),
    ("min_temp", "max_temp", "Must be lower than the max limit"),
    ("gap_non_urgent_minutes", "gap_urgent_minutes", "Must be lower than the urgent limit"),
)


class ThresholdsIn(BaseModel):
    """Threshold settings the user creates or edits; °C for growth and limits, minutes for gaps."""

    name: Name
    growth_non_urgent: float = Field(gt=0)
    growth_urgent: float = Field(gt=0)
    min_temp: float
    max_temp: float
    gap_non_urgent_minutes: int = Field(gt=0)
    gap_urgent_minutes: int = Field(gt=0)

    @model_validator(mode="after")
    def low_below_high(self):
        """Each low value (non-urgent, min) must be lower than its pair; the error is on the low field."""
        errors = [
            InitErrorDetails(
                type=PydanticCustomError("low_not_below_high", message),
                loc=(low,),
                input=getattr(self, low),
            )
            for low, high, message in PAIRS
            if getattr(self, low) >= getattr(self, high)
        ]
        if errors:
            raise ValidationError.from_exception_data(type(self).__name__, errors)
        return self


class ThresholdsOut(ThresholdsIn):
    """Threshold settings with their id and how many fridges use them."""

    id: int
    fridges: int
