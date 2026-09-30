import logging

from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.models import Fridge, ThresholdSettings
from app.models.threshold_settings import DEFAULT_SETTINGS_NAME
from app.services.detection.service import redetect
from app.services.errors import ConflictError, get_or_raise

logger = logging.getLogger(__name__)


def default_settings(session) -> ThresholdSettings:
    """Return the "default" threshold settings with the suggested values, creating them on first use."""
    with session.no_autoflush:
        settings = session.scalar(
            select(ThresholdSettings).where(func.lower(ThresholdSettings.name) == DEFAULT_SETTINGS_NAME)
        )
    if settings is None:
        settings = ThresholdSettings(name=DEFAULT_SETTINGS_NAME)
        session.add(settings)
        logger.info("Created the default threshold settings")
    return settings


def list_settings(session) -> list[tuple[ThresholdSettings, int]]:
    """All threshold settings ordered by name, each with the number of fridges using them."""
    stmt = (
        select(ThresholdSettings, func.count(Fridge.id))
        .outerjoin(Fridge, Fridge.threshold_settings_id == ThresholdSettings.id)
        .group_by(ThresholdSettings.id)
        .order_by(ThresholdSettings.name)
    )
    return [(settings, count) for settings, count in session.execute(stmt)]


def fridge_count(session, settings_id: int) -> int:
    """Number of fridges using the threshold settings."""
    return session.scalar(select(func.count(Fridge.id)).where(Fridge.threshold_settings_id == settings_id))


def _check_name_is_free(session, name: str, settings_id: int | None = None) -> None:
    """Raise ConflictError on "name" when other threshold settings already use this name, in any case."""
    stmt = select(ThresholdSettings.id).where(func.lower(ThresholdSettings.name) == name.lower())
    if settings_id is not None:
        stmt = stmt.where(ThresholdSettings.id != settings_id)
    if session.scalar(stmt) is not None:
        raise ConflictError("This name is already used", field="name")


def create_settings(session, values: dict) -> ThresholdSettings:
    """Create named threshold settings; a duplicate name raises ConflictError (409)."""
    _check_name_is_free(session, values["name"])
    settings = ThresholdSettings(**values)
    session.add(settings)
    session.commit()
    logger.info("Created threshold settings id=%s", settings.id)
    return settings


def update_settings(session, settings_id: int, values: dict) -> ThresholdSettings:
    """Replace the name and values; it changes the alerts of every fridge using these settings."""
    settings = get_or_raise(session, ThresholdSettings, settings_id)
    _check_name_is_free(session, values["name"], settings_id)
    for field, value in values.items():
        setattr(settings, field, value)
    session.flush()
    redetect(session, {fridge.id for fridge in settings.fridges})
    session.commit()
    logger.info("Updated threshold settings id=%s used by %d fridges", settings_id, fridge_count(session, settings_id))
    return settings


def delete_settings(session, settings_id: int) -> None:
    """Delete threshold settings no fridge uses; while fridges use them, raise ConflictError (409) with the count."""
    settings = get_or_raise(session, ThresholdSettings, settings_id)
    count = fridge_count(session, settings_id)
    if count:
        raise ConflictError(f"Used by {count} fridge{'s' if count != 1 else ''}. Move them to other threshold settings first.")
    session.delete(settings)
    session.commit()
    logger.info("Deleted threshold settings id=%s", settings_id)


@event.listens_for(Session, "before_flush")
def _attach_default_settings(session, flush_context, instances):
    """Attach every new fridge without threshold settings to the "default" ones."""
    new_fridges = [obj for obj in session.new if isinstance(obj, Fridge) and obj.threshold_settings is None]
    if new_fridges:
        settings = default_settings(session)
        for fridge in new_fridges:
            fridge.threshold_settings = settings
