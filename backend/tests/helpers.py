from sqlalchemy import func, select

from app.models import Branch, Fridge, Logger, Metric


def add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512", metric=Metric.C) -> Fridge:
    """Create a fridge (and its branch if missing) with one logger."""
    existing = session.scalar(select(Branch).where(func.lower(Branch.name) == branch.lower()))
    new_fridge = Fridge(branch=existing or Branch(name=branch, city=branch), name=fridge, metric=metric)
    if logger:
        new_fridge.logger = Logger(id=logger)
    session.add(new_fridge)
    session.commit()
    return new_fridge
