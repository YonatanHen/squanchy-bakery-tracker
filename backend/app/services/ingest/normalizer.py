from datetime import datetime
from typing import Any

LOGGER_PATTERN = r"^TL-\d{4}$"


def collapse_spaces(value: Any) -> str:
    """Trim a value and collapse inner runs of spaces; None becomes an empty string."""
    return " ".join(str(value).split()) if value is not None else ""


DATE_FORMATS = ("%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M")


def parse_time(value: Any) -> datetime:
    """Parse a reading time from the sample formats or an Excel datetime cell; raises ValueError."""
    if isinstance(value, datetime):
        return value
    text = collapse_spaces(value)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date '{text}'. Use YYYY-MM-DD HH:MM or DD/MM/YYYY HH:MM")


def parse_temp(value: Any) -> float | None:
    """Parse a temperature as given (no unit conversion); None means an ERR reading; raises ValueError."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = collapse_spaces(value)
    if text.upper() == "ERR":
        return None
    try:
        return float(text)
    except ValueError:
        raise ValueError("Temperature must be a number or ERR") from None
