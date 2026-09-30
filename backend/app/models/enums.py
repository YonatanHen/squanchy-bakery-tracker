import enum

from sqlalchemy import Enum


class Metric(str, enum.Enum):
    """Temperature unit a fridge's logger reports in."""

    C = "C"
    F = "F"


metric_enum = Enum(Metric, name="metric")
