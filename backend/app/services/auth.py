import logging

from sqlalchemy import select

from app.models import User
from app.services.tokens import create_token

logger = logging.getLogger(__name__)


def authenticate(session, username: str, password: str) -> str | None:
    """Check the credentials and issue a token.

    Args:
        session: The SQLAlchemy session.
        username: Login name.
        password: Plain password as typed; never logged or stored.

    Returns:
        A JWT for a valid user, or None for a wrong username or password.
    """
    user = session.scalar(select(User).where(User.username == username))
    if user is None or not user.check_password(password):
        logger.warning("Login failed for username=%s", username)
        return None
    logger.info("Login succeeded for username=%s", user.username)
    return create_token(user.username)
