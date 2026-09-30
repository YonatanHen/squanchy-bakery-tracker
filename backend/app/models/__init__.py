"""SQLAlchemy models, one model per module."""

from app.models import archive  # noqa: F401  registers archive tables
from app.models.alert import Alert
from app.models.branch import Branch
from app.models.enums import AlertKind, AlertLevel, Metric, Status
from app.models.fridge import Fridge
from app.models.logger import Logger
from app.models.reader import Reader
from app.models.threshold_settings import ThresholdSettings
from app.models.user import User

__all__ = [
    "Alert", "AlertKind", "AlertLevel", "Branch", "Fridge", "Logger", "Metric", "Reader", "Status", "ThresholdSettings", "User",
]
