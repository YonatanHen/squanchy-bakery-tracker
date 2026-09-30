import logging

from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.models import Fridge, ThresholdSettings
from app.models.threshold_settings import DEFAULT_PROFILE

logger = logging.getLogger(__name__)


def default_profile(session) -> ThresholdSettings:
    """Return the "default" profile with the suggested values, creating it on first use."""
    with session.no_autoflush:
        profile = session.scalar(select(ThresholdSettings).where(func.lower(ThresholdSettings.name) == DEFAULT_PROFILE))
    if profile is None:
        profile = ThresholdSettings(name=DEFAULT_PROFILE)
        session.add(profile)
        logger.info("Created the default threshold profile")
    return profile


@event.listens_for(Session, "before_flush")
def _attach_default_profile(session, flush_context, instances):
    """Attach every new fridge without a profile to the "default" profile."""
    new_fridges = [obj for obj in session.new if isinstance(obj, Fridge) and obj.threshold_settings is None]
    if new_fridges:
        profile = default_profile(session)
        for fridge in new_fridges:
            fridge.threshold_settings = profile
