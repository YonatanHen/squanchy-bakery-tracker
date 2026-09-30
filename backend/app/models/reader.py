from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db
from app.models.enums import Metric, Status, metric_enum, status_enum

if TYPE_CHECKING:
    from app.models.alert import Alert
    from app.models.logger import Logger


class Reader(db.Model):
    """One logger reading, stored with its original value and metric."""

    __tablename__ = "reader"
    __table_args__ = (
        UniqueConstraint("logger_id", "time", name="uq_reader_logger_time"),
        CheckConstraint(
            "(status = 'OK' AND temp IS NOT NULL) OR (status = 'ERR' AND temp IS NULL)",
            name="ck_reader_status_temp",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # No delete cascade: readings are archived first (app.services.archive); a logger rename still follows.
    logger_id: Mapped[str] = mapped_column(ForeignKey("logger.id", ondelete="RESTRICT", onupdate="CASCADE"))
    time: Mapped[datetime] = mapped_column(DateTime)
    temp: Mapped[float | None] = mapped_column()
    metric: Mapped[Metric] = mapped_column(metric_enum)
    status: Mapped[Status] = mapped_column(status_enum)

    logger: Mapped["Logger"] = relationship(back_populates="readings")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="reader", passive_deletes="all")
