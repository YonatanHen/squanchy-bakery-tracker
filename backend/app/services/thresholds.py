import logging

from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.models import Fridge, ThresholdSettings
from app.models.threshold_settings import DEFAULT_PROFILE
from app.services.errors import get_or_raise

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


def list_profiles(session) -> list[tuple[ThresholdSettings, int]]:
    """All profiles ordered by name, each with the number of fridges using it."""
    stmt = (
        select(ThresholdSettings, func.count(Fridge.id))
        .outerjoin(Fridge, Fridge.threshold_settings_id == ThresholdSettings.id)
        .group_by(ThresholdSettings.id)
        .order_by(ThresholdSettings.name)
    )
    return [(profile, count) for profile, count in session.execute(stmt)]


def fridge_count(session, profile_id: int) -> int:
    """Number of fridges using the profile."""
    return session.scalar(select(func.count(Fridge.id)).where(Fridge.threshold_settings_id == profile_id))


def create_profile(session, values: dict) -> ThresholdSettings:
    """Create a named profile; a duplicate name raises IntegrityError (409)."""
    profile = ThresholdSettings(**values)
    session.add(profile)
    session.commit()
    logger.info("Created threshold profile id=%s", profile.id)
    return profile


def update_profile(session, profile_id: int, values: dict) -> ThresholdSettings:
    """Replace a profile's name and values; it changes the alerts of every fridge using it."""
    profile = get_or_raise(session, ThresholdSettings, profile_id)
    for field, value in values.items():
        setattr(profile, field, value)
    session.commit()
    logger.info("Updated threshold profile id=%s used by %d fridges", profile_id, fridge_count(session, profile_id))
    return profile


def delete_profile(session, profile_id: int) -> None:
    """Delete a profile no fridge uses; while fridges use it the DB refuses (IntegrityError, 409)."""
    session.delete(get_or_raise(session, ThresholdSettings, profile_id))
    session.commit()
    logger.info("Deleted threshold profile id=%s", profile_id)


@event.listens_for(Session, "before_flush")
def _attach_default_profile(session, flush_context, instances):
    """Attach every new fridge without a profile to the "default" profile."""
    new_fridges = [obj for obj in session.new if isinstance(obj, Fridge) and obj.threshold_settings is None]
    if new_fridges:
        profile = default_profile(session)
        for fridge in new_fridges:
            fridge.threshold_settings = profile
