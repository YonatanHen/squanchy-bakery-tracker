from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db

if TYPE_CHECKING:
    from app.models.fridge import Fridge
    from app.models.reader import Reader


class Logger(db.Model):
    """A temperature logger (TL-NNNN); one logger per fridge, one fridge per logger."""

    __tablename__ = "logger"

    id: Mapped[str] = mapped_column(String(7), primary_key=True)
    fridge_id: Mapped[int] = mapped_column(ForeignKey("fridge.id", ondelete="CASCADE"), unique=True)

    fridge: Mapped["Fridge"] = relationship(back_populates="logger")
    readings: Mapped[list["Reader"]] = relationship(
        back_populates="logger", cascade="all, delete-orphan", passive_deletes=True
    )
