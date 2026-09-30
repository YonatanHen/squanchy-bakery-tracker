import logging

from pydantic import BaseModel, ValidationInfo, model_validator
from sqlalchemy import select

from app.models import Branch, Fridge, Logger, Metric
from app.schemas.types import BuildingNumber, LoggerId, Name
from app.services.ingest.registry import Registry, load_registry

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
    """Branches and fridges/loggers to create before the rows are validated; context holds the current registry."""

    branches: list[NewBranch] = []
    fridges: list[NewFridge] = []

    @model_validator(mode="after")
    def skip_applied_and_reject_conflicts(self, info: ValidationInfo):
        """Drop entries that already exist (a re-sent block is safe); reject entries that clash with other data."""
        registry: Registry = info.context["registry"]
        self.branches = [b for b in self.branches if b.name.lower() not in registry.branches]
        known = set(registry.branches) | {b.name.lower() for b in self.branches}
        logger_of_fridge = {info_.fridge_id: logger_id for logger_id, info_ in registry.loggers.items()}
        fridges = []
        for new in self.fridges:
            branch = new.branch.lower()
            if branch not in known:
                raise ValueError(f"Branch '{new.branch}' does not exist. Add it to branches")
            owner = registry.loggers.get(new.logger_id)
            if owner is not None:
                if (owner.branch.lower(), owner.fridge.lower()) == (branch, new.fridge.lower()):
                    continue  # already registered by an earlier upload
                raise ValueError(f"Logger {new.logger_id} already belongs to {owner.branch} / {owner.fridge}")
            fridge_id = registry.fridges.get((branch, new.fridge.lower()))
            if fridge_id in logger_of_fridge:
                raise ValueError(
                    f"Fridge '{new.fridge}' in {registry.branches[branch]} already has logger "
                    f"{logger_of_fridge[fridge_id]}; edit the fridge's logger instead"
                )
            fridges.append(new)
        self.fridges = fridges
        return self


def parse_registration(session, raw: str | dict | None) -> Registration | None:
    """Validate a register block (JSON text or dict); raises ValidationError when invalid."""
    if not raw:
        return None
    context = {"registry": load_registry(session)}
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
