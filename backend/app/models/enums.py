import enum

from sqlalchemy import Enum


class Metric(str, enum.Enum):
    """Temperature unit a fridge's logger reports in."""

    C = "C"
    F = "F"


metric_enum = Enum(Metric, name="metric")


class Status(str, enum.Enum):
    """Reading status; ERR means the logger reported no temperature."""

    OK = "OK"
    ERR = "ERR"


status_enum = Enum(Status, name="status")


class AlertLevel(str, enum.Enum):
    """Alert severity; NON_URGENT shows as a light alert in the UI."""

    URGENT = "URGENT"
    NON_URGENT = "NON_URGENT"


alert_level_enum = Enum(AlertLevel, name="alert_level")
