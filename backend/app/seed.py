import logging

from sqlalchemy import select

from app.models import User

logger = logging.getLogger(__name__)


def seed_admin(session, username: str = "admin", password: str = "password") -> User:
    """Create Summer's admin user once; later calls return the existing user.

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
