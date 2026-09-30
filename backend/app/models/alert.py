from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db
from app.models.enums import AlertLevel, alert_level_enum

if TYPE_CHECKING:
    from app.models.reader import Reader


class Alert(db.Model):
    """An alert raised on one reading by the detection rules."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    # No cascade: a reading with alerts is archived first (app.archive), never deleted with them.
    reader_id: Mapped[int] = mapped_column(ForeignKey("reader.id", ondelete="RESTRICT"))
    description: Mapped[str] = mapped_column(String(500))
    level: Mapped[AlertLevel] = mapped_column(alert_level_enum)

    reader: Mapped["Reader"] = relationship(back_populates="alerts")
