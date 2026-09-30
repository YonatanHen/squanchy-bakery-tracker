from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app


def create_token(username: str, expires_minutes: int | None = None) -> str:
    """Sign a JWT for the user.

    Args:
        username: Stored as the token subject.
        expires_minutes: Lifetime; defaults to JWT_EXPIRES_MINUTES from the config.

    Returns:
        The encoded token.
    """
    minutes = current_app.config["JWT_EXPIRES_MINUTES"] if expires_minutes is None else expires_minutes
    payload = {"sub": username, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def decode_token(token: str) -> str:
    """Return the username of a valid token; raises jwt.InvalidTokenError otherwise."""
    payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    return payload["sub"]
