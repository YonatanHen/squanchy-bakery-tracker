from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Branch, Fridge, Metric


@dataclass(frozen=True)
class LoggerInfo:
    """Where a registered logger is and which unit it reports in."""

    fridge_id: int
    branch: str
    fridge: str
    metric: Metric


@dataclass(frozen=True)
class Registry:
    """Snapshot of registered data; keys are lowercase names, values the stored spelling."""

    branches: dict[str, str]
    loggers: dict[str, LoggerInfo]
    fridges: dict[tuple[str, str], int]


def load_registry(session) -> Registry:
    """Load the registered branches, fridges and loggers used to validate an upload."""
    branches = {b.name.lower(): b.name for b in session.scalars(select(Branch))}
    loggers: dict[str, LoggerInfo] = {}
    fridges: dict[tuple[str, str], int] = {}
    query = select(Fridge).options(selectinload(Fridge.branch), selectinload(Fridge.logger))
    for fridge in session.scalars(query):
        fridges[(fridge.branch.name.lower(), fridge.name.lower())] = fridge.id
        if fridge.logger:
            loggers[fridge.logger.id] = LoggerInfo(fridge.id, fridge.branch.name, fridge.name, fridge.metric)
    return Registry(branches, loggers, fridges)
