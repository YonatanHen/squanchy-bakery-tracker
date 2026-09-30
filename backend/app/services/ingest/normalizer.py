from typing import Any

LOGGER_PATTERN = r"^TL-\d{4}$"


def collapse_spaces(value: Any) -> str:
    """Trim a value and collapse inner runs of spaces; None becomes an empty string."""
    return " ".join(str(value).split()) if value is not None else ""
