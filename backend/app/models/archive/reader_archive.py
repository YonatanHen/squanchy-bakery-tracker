from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import db
from app.models.enums import Metric, Status, metric_enum, status_enum


class ReaderArchive(db.Model):
    """A deleted reading, kept with its branch and fridge names so it can still be answered for."""

    __tablename__ = "reader_archive"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)  # the original reader id
    logger_id: Mapped[str] = mapped_column(String(7))
    branch: Mapped[str] = mapped_column(String(100))
    fridge: Mapped[str] = mapped_column(String(100))
    time: Mapped[datetime] = mapped_column(DateTime)
    temp: Mapped[float | None] = mapped_column()
    metric: Mapped[Metric] = mapped_column(metric_enum)
    status: Mapped[Status] = mapped_column(status_enum)
    archived_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
