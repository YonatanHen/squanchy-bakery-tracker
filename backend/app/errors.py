from typing import Any

from pydantic import BaseModel, ValidationError


class FieldError(BaseModel):
    """One invalid value, with its file row when it came from an upload."""

    row: int | None = None
    field: str
    value: Any = None
    message: str


def _jsonable(value: Any) -> Any:
    """Keep JSON scalars as they are; turn anything else into text."""
    return value if value is None or isinstance(value, (str, int, float, bool)) else str(value)


def field_errors(exc: ValidationError, row: int | None = None) -> list[FieldError]:
    """Convert a Pydantic ValidationError into one FieldError per invalid field.

    Args:
        exc: The validation error.
        row: File row number, for upload errors.

    Returns:
        The field errors, in Pydantic's order.
    """
    return [
        FieldError(
            row=row,
            field=".".join(str(part) for part in e["loc"]) or "body",
            value=None if e["type"] == "missing" else _jsonable(e.get("input")),
            message=e["msg"].removeprefix("Value error, "),
        )
        for e in exc.errors()
    ]
