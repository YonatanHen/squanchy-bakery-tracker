import logging

from sqlalchemy import func, select

from app.models import Branch, Fridge, Logger, Metric, User

logger = logging.getLogger(__name__)

SAMPLE_FRIDGES = [
    ("Jerusalem", "Dairy", "TL-0512", Metric.C),
    ("Tel Aviv", "Walk-in", "TL-0417", Metric.C),
    ("Haifa", "Dairy", "TL-0231", Metric.F),
    ("Rishon LeZion", "Cream cakes", "TL-0388", Metric.C),
]

SAMPLE_HEADER = ["Logger", "Branch", "Fridge", "Time", "Temp"]

# The 16 rows from the assignment, unchanged.
SAMPLE_ROWS = [
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 06:00", 4.1],
    ["TL-0231", "Haifa", "Dairy", "14/09/2026 06:00", 38.3],
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:15", 3.9],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 06:15", 9.4],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:00", 4.6],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 06:30", 4.3],
    ["TL-0231", "Haifa", "Dairy", "14/09/2026 06:15", 39.0],
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:15", 3.9],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:15", 5.4],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 05:45", 4.0],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:30", 6.3],
    ["TL-0231", "Haifa", "Dairy", "14/09/2026 06:30", "ERR"],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:45", 7.1],
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 08:30", 4.0],
    ["TL-0417", "tel aviv", "Display 2", "2026-09-17 06:00", 3.7],
]


def seed_sample_fridges(session) -> None:
    """Create the 4 known branches, each with its sample fridge and logger; safe to run twice."""
    added = 0
    for branch_name, fridge_name, logger_id, metric in SAMPLE_FRIDGES:
        if session.get(Logger, logger_id):
            continue
        branch = session.scalar(select(Branch).where(func.lower(Branch.name) == branch_name.lower()))
        branch = branch or Branch(name=branch_name, city=branch_name)
        session.add(Fridge(branch=branch, name=fridge_name, metric=metric, logger=Logger(id=logger_id)))
        added += 1
    session.commit()
    if added:
        logger.info("Seeded %d sample fridges", added)


def seed_admin(session, username: str = "admin", password: str = "password") -> User:
    """Create the admin user once; later calls return the existing user.

    Args:
        session: The SQLAlchemy session.
        username: Login name of the admin.
        password: Initial password; only its hash is stored.

    Returns:
        The admin user.
    """
    user = session.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username)
        user.set_password(password)
        session.add(user)
        session.commit()
        logger.info("Seeded admin user")
    return user
