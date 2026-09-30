from pydantic import BaseModel, ConfigDict

from app.schemas.fridge import FridgeOut
from app.schemas.types import BuildingNumber, Name


class BranchOut(BaseModel):
    """A branch with its fridges, as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str | None
    street: str | None
    building_number: str | None
    fridges: list[FridgeOut]


class BranchPatch(BaseModel):
    """Branch fields the user can edit; only the fields sent are changed."""

    name: Name | None = None
    city: Name | None = None
    street: Name | None = None
    building_number: BuildingNumber | None = None
