from pydantic import BaseModel, Field, ValidationError, model_validator
from pydantic_core import InitErrorDetails, PydanticCustomError

from app.schemas.types import Name

PAIRS = (
    ("growth_non_urgent", "growth_urgent"),
    ("deviation_non_urgent", "deviation_urgent"),
    ("gap_non_urgent_minutes", "gap_urgent_minutes"),
)


class ThresholdsIn(BaseModel):
    """Threshold settings the user creates or edits; °C for growth/deviation, minutes for gaps."""

    name: Name
    growth_non_urgent: float = Field(gt=0)
    growth_urgent: float = Field(gt=0)
    deviation_non_urgent: float = Field(gt=0)
    deviation_urgent: float = Field(gt=0)
    gap_non_urgent_minutes: int = Field(gt=0)
    gap_urgent_minutes: int = Field(gt=0)

    @model_validator(mode="after")
    def non_urgent_below_urgent(self):
        """Each non-urgent limit must be lower than its urgent limit; the error is on the non-urgent field."""
        errors = [
            InitErrorDetails(
                type=PydanticCustomError("non_urgent_not_below_urgent", "Must be lower than the urgent limit"),
                loc=(low,),
                input=getattr(self, low),
            )
            for low, high in PAIRS
            if getattr(self, low) >= getattr(self, high)
        ]
        if errors:
            raise ValidationError.from_exception_data(type(self).__name__, errors)
        return self


class ThresholdsOut(ThresholdsIn):
    """Threshold settings with their id and how many fridges use them."""

    id: int
    fridges: int
