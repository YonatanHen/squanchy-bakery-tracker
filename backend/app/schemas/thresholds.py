from pydantic import BaseModel, Field, model_validator

from app.schemas.types import Name

PAIRS = (
    ("growth_non_urgent", "growth_urgent"),
    ("deviation_non_urgent", "deviation_urgent"),
    ("gap_non_urgent_minutes", "gap_urgent_minutes"),
)


class ThresholdsIn(BaseModel):
    """A threshold profile the user creates or edits; °C for growth/deviation, minutes for gaps."""

    name: Name
    growth_non_urgent: float = Field(gt=0)
    growth_urgent: float = Field(gt=0)
    deviation_non_urgent: float = Field(gt=0)
    deviation_urgent: float = Field(gt=0)
    gap_non_urgent_minutes: int = Field(gt=0)
    gap_urgent_minutes: int = Field(gt=0)

    @model_validator(mode="after")
    def non_urgent_below_urgent(self):
        """Each non-urgent limit must be lower than its urgent limit."""
        for low, high in PAIRS:
            if getattr(self, low) >= getattr(self, high):
                raise ValueError(f"{low} must be lower than {high}")
        return self


class ThresholdsOut(ThresholdsIn):
    """A threshold profile with its id and how many fridges use it."""

    id: int
    fridges: int
