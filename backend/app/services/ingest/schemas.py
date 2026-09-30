import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ValidationInfo, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.models import Status
from app.services.ingest.normalizer import LOGGER_PATTERN, collapse_spaces, parse_temp, parse_time
from app.services.ingest.registry import Registry


def _registry(info: ValidationInfo) -> Registry:
    """The registry passed as validation context."""
    return info.context["registry"]


def _required(value: Any, message: str) -> str:
    """Return the value with spaces collapsed; an empty cell raises the field's "required" message."""
    text = collapse_spaces(value)
    if not text:
        raise ValueError(message)
    return text


class ReadingIn(BaseModel):
    """One uploaded reading row, validated against the registry passed as context; no field may be empty."""

    logger: str
    branch: str
    fridge: str
    time: datetime
    temp: float | None
    status: Status = Status.OK

    @field_validator("logger", mode="before")
    @classmethod
    def known_logger(cls, value: Any, info: ValidationInfo) -> str:
        """Normalize to TL-NNNN and require a registered logger."""
        logger_id = _required(value, "Logger id is required").upper()
        if not re.fullmatch(LOGGER_PATTERN, logger_id):
            raise ValueError("Logger id must match TL-NNNN")
        if logger_id not in _registry(info).loggers:
            raise PydanticCustomError("unknown_logger", "Unknown logger")
        return logger_id

    @field_validator("branch", mode="before")
    @classmethod
    def known_branch(cls, value: Any, info: ValidationInfo) -> str:
        """Match a registered branch in any case; a known logger must belong to it."""
        registry = _registry(info)
        name = registry.branches.get(_required(value, "Branch is required").lower())
        if name is None:
            raise PydanticCustomError("unknown_branch", "Unknown branch name")
        logger_id = info.data.get("logger")
        if logger_id and registry.loggers[logger_id].branch != name:
            raise ValueError(f"Logger {logger_id} belongs to branch {registry.loggers[logger_id].branch}")
        return name

    @field_validator("fridge", mode="before")
    @classmethod
    def fridge_of_logger(cls, value: Any, info: ValidationInfo) -> str:
        """Use the stored fridge name; a new name for the same logger is a display rename."""
        name = _required(value, "Fridge name is required")
        registry, logger_id, branch = _registry(info), info.data.get("logger"), info.data.get("branch")
        if not (logger_id and branch):
            return name
        own = registry.loggers[logger_id]
        if name.lower() == own.fridge.lower():
            return own.fridge
        other = registry.fridges.get((branch.lower(), name.lower()))
        if other is not None and other != own.fridge_id:
            raise ValueError(f"Fridge '{name}' uses another logger")
        return name

    @field_validator("time", mode="before")
    @classmethod
    def normalized_time(cls, value: Any) -> datetime:
        """Parse the sample date formats or an Excel datetime cell."""
        if isinstance(value, datetime):
            return value
        return parse_time(_required(value, "Time is required"))

    @field_validator("temp", mode="before")
    @classmethod
    def normalized_temp(cls, value: Any) -> float | None:
        """Keep the number as given; ERR becomes None."""
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
        return parse_temp(_required(value, "Temperature is required"))

    @model_validator(mode="after")
    def err_status(self):
        """Mark a reading with no temperature as ERR."""
        self.status = Status.ERR if self.temp is None else Status.OK
        return self
