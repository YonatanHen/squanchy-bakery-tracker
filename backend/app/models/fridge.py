from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db
from app.models.branch import Branch
from app.models.enums import Metric, metric_enum
from app.models.threshold_settings import ThresholdSettings


class Fridge(db.Model):
    """A fridge in a branch; its metric is the unit its third-party logger reports in."""

    __tablename__ = "fridge"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branch.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    metric: Mapped[Metric] = mapped_column(metric_enum, default=Metric.C)
    avg_temp: Mapped[float | None] = mapped_column()
    last_measured: Mapped[datetime | None] = mapped_column(DateTime)

    branch: Mapped[Branch] = relationship(back_populates="fridges")
    thresholds: Mapped[ThresholdSettings] = relationship(
        back_populates="fridge", cascade="all, delete-orphan", passive_deletes=True
    )

    def __init__(self, **kwargs):
        """Create the fridge with a default thresholds row unless one is given."""
        kwargs.setdefault("thresholds", ThresholdSettings())
        super().__init__(**kwargs)


Index("uq_fridge_branch_name_lower", Fridge.branch_id, func.lower(Fridge.name), unique=True)
