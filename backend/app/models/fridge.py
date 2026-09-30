from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db
from app.models.branch import Branch
from app.models.enums import Metric, metric_enum
from app.models.threshold_settings import ThresholdSettings

if TYPE_CHECKING:
    from app.models.logger import Logger


class Fridge(db.Model):
    """A fridge in a branch; its metric is the unit its third-party logger reports in."""

    __tablename__ = "fridge"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branch.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    metric: Mapped[Metric] = mapped_column(metric_enum, default=Metric.C)
    last_measured: Mapped[datetime | None] = mapped_column(DateTime)
    # Shared threshold settings; new fridges get "default" (services/thresholds.py).
    threshold_settings_id: Mapped[int] = mapped_column(ForeignKey("threshold_settings.id", ondelete="RESTRICT"))

    branch: Mapped[Branch] = relationship(back_populates="fridges")
    threshold_settings: Mapped[ThresholdSettings] = relationship(back_populates="fridges")
    logger: Mapped["Logger | None"] = relationship(
        back_populates="fridge", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def logger_id(self) -> str | None:
        """Id of the fridge's logger, or None when it has none."""
        return self.logger.id if self.logger else None


Index("uq_fridge_branch_name_lower", Fridge.branch_id, func.lower(Fridge.name), unique=True)
