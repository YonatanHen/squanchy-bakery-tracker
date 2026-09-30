import logging

from sqlalchemy import Select, case, func, select

from app.models import Branch, Fridge, Logger, Metric, Reader
from app.schemas.reading import LocationFilters, ReadingFilters
from app.services.units import to_celsius

logger = logging.getLogger(__name__)

TEXT_COLUMNS = {
    "branch": Branch.name, "city": Branch.city, "street": Branch.street,
    "building_number": Branch.building_number, "fridge": Fridge.name, "logger_id": Logger.id,
}
TEMP_C = case((Reader.metric == Metric.F, (Reader.temp - 32) * 5 / 9), else_=Reader.temp)


def apply_location_filters(stmt: Select, f: LocationFilters) -> Select:
    """Apply the shared location and date filters; stmt must join Reader, Logger, Fridge and Branch."""
    for name, column in TEXT_COLUMNS.items():
        value = getattr(f, name)
        if value:
            stmt = stmt.where(func.lower(column) == value.lower())
    if f.date_from:
        stmt = stmt.where(Reader.time >= f.date_from)
    if f.date_to:
        stmt = stmt.where(Reader.time <= f.date_to)
    return stmt


def query_readings(session, f: ReadingFilters) -> tuple[list[tuple[Reader, Fridge, Branch]], int]:
    """Filter readings; the temperature range is compared in °C, so °F fridges match correctly.

    Args:
        session: The SQLAlchemy session.
        f: Validated filters.

    Returns:
        The page of (reading, fridge, branch) rows in time order, and the total number of matches.
    """
    stmt = (
        select(Reader, Fridge, Branch)
        .join(Logger, Reader.logger_id == Logger.id)
        .join(Fridge, Logger.fridge_id == Fridge.id)
        .join(Branch, Fridge.branch_id == Branch.id)
    )
    stmt = apply_location_filters(stmt, f)
    if f.temp_min is not None:
        stmt = stmt.where(TEMP_C >= to_celsius(f.temp_min, f.unit))
    if f.temp_max is not None:
        stmt = stmt.where(TEMP_C <= to_celsius(f.temp_max, f.unit))
    if f.status:
        stmt = stmt.where(Reader.status == f.status)
    if f.metric:
        stmt = stmt.where(Reader.metric == f.metric)
    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = session.execute(stmt.order_by(Reader.time, Reader.id).offset(f.offset).limit(f.limit)).all()
    logger.info("Readings query matched %d rows", total)
    return [tuple(row) for row in rows], total
