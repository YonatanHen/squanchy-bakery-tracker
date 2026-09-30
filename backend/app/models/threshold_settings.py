from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db

if TYPE_CHECKING:
    from app.models.fridge import Fridge


class ThresholdSettings(db.Model):
    """Alert thresholds of one fridge, in °C and minutes."""

    __tablename__ = "threshold_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    fridge_id: Mapped[int] = mapped_column(ForeignKey("fridge.id", ondelete="CASCADE"), unique=True)
    growth_non_urgent: Mapped[float] = mapped_column(default=0.1)
    growth_urgent: Mapped[float] = mapped_column(default=1.0)
    deviation_non_urgent: Mapped[float] = mapped_column(default=1.5)
    deviation_urgent: Mapped[float] = mapped_column(default=3.0)
    gap_non_urgent_minutes: Mapped[int] = mapped_column(default=15)
    gap_urgent_minutes: Mapped[int] = mapped_column(default=120)

    fridge: Mapped["Fridge"] = relationship(back_populates="thresholds")
