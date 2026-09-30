from typing import TYPE_CHECKING

from sqlalchemy import Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db

if TYPE_CHECKING:
    from app.models.fridge import Fridge

DEFAULT_SETTINGS_NAME = "default"


class ThresholdSettings(db.Model):
    """Named alert threshold settings (°C and minutes), shared by any number of fridges."""

    __tablename__ = "threshold_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))  # human-readable, e.g. "default", "Dairy"
    growth_non_urgent: Mapped[float] = mapped_column(default=0.1)
    growth_urgent: Mapped[float] = mapped_column(default=1.0)
    min_temp: Mapped[float] = mapped_column(default=0.0)
    max_temp: Mapped[float] = mapped_column(default=5.0)  # the inspector's 5°C
    gap_non_urgent_minutes: Mapped[int] = mapped_column(default=15)
    gap_urgent_minutes: Mapped[int] = mapped_column(default=120)

    # passive_deletes="all": the DB refuses deleting threshold settings that fridges still use.
    fridges: Mapped[list["Fridge"]] = relationship(back_populates="threshold_settings", passive_deletes="all")


Index("uq_threshold_settings_name_lower", func.lower(ThresholdSettings.name), unique=True)
