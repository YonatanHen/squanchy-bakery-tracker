from pydantic import BaseModel, ConfigDict

from app.schemas.fridge import FridgeOut


class BranchOut(BaseModel):
    """A branch with its fridges, as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str | None
    street: str | None
    building_number: str | None
    fridges: list[FridgeOut]
