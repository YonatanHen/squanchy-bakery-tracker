import logging

from pydantic import BaseModel, ValidationInfo, model_validator
from sqlalchemy import select

from app.models import Branch, Fridge, Logger, Metric
from app.schemas.types import BuildingNumber, LoggerId, Name

logger = logging.getLogger(__name__)


class NewBranch(BaseModel):
    """A branch the user confirmed adding; the city is asked in the dialog, the address is optional."""

    name: Name
    city: Name
    street: Name | None = None
    building_number: BuildingNumber | None = None


class NewFridge(BaseModel):
    """A new logger with its fridge, confirmed by the user."""

    logger_id: LoggerId
    branch: Name
    fridge: Name
    metric: Metric = Metric.C


class Registration(BaseModel):
    """Branches and fridges/loggers to create before the rows are validated; context holds existing branch names."""

    branches: list[NewBranch] = []
    fridges: list[NewFridge] = []

    @model_validator(mode="after")
    def fridge_branches_exist(self, info: ValidationInfo):
        """Each new fridge must be in a registered branch or one added in this block."""
        known = info.context["branches"] | {b.name.lower() for b in self.branches}
        for new in self.fridges:
            if new.branch.lower() not in known:
                raise ValueError(f"Branch '{new.branch}' does not exist. Add it to branches")
        return self


def parse_registration(session, raw: str | dict | None) -> Registration | None:
    """Validate a register block (JSON text or dict); raises ValidationError when invalid."""
    if not raw:
        return None
    context = {"branches": {name.lower() for name in session.scalars(select(Branch.name))}}
    if isinstance(raw, str):
        return Registration.model_validate_json(raw, context=context)
    return Registration.model_validate(raw, context=context)


def apply_registration(session, registration: Registration) -> None:
    """Add the confirmed branches, fridges and loggers to the session; committed with the readings."""
    branches = {b.name.lower(): b for b in session.scalars(select(Branch))}
    for new in registration.branches:
        branches[new.name.lower()] = Branch(**new.model_dump())
        session.add(branches[new.name.lower()])
    for new in registration.fridges:
        branch = branches[new.branch.lower()]
        session.add(Fridge(branch=branch, name=new.fridge, metric=new.metric, logger=Logger(id=new.logger_id)))
    session.flush()
    logger.info("Registered %d branches and %d fridges with loggers", len(registration.branches), len(registration.fridges))
