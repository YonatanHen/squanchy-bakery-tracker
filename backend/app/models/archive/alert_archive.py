from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import db
from app.models.enums import AlertLevel, alert_level_enum


class AlertArchive(db.Model):
    """An alert of a deleted reading; reader_id points to its row in reader_archive."""

    __tablename__ = "alert_archive"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)  # the original alert id
    reader_id: Mapped[int] = mapped_column(index=True)
    description: Mapped[str] = mapped_column(String(500))
    level: Mapped[AlertLevel] = mapped_column(alert_level_enum)
    archived_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
