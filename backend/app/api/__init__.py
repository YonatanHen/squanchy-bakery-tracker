import logging

import jwt
from flask import Blueprint, g, request

from app.services.tokens import decode_token

logger = logging.getLogger(__name__)

api_v1 = Blueprint("api_v1", __name__, url_prefix="/api/v1")

PUBLIC_ENDPOINTS = {"api_v1.health", "api_v1.login"}


@api_v1.before_request
def require_token():
    """Refuse every non-public route without a valid Bearer token."""
    if request.endpoint in PUBLIC_ENDPOINTS:
        return None
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        logger.warning("Refused %s %s: missing token", request.method, request.path)
        return {"error": "Missing token"}, 401
    try:
        g.username = decode_token(header.removeprefix("Bearer "))
    except jwt.InvalidTokenError:
        logger.warning("Refused %s %s: invalid or expired token", request.method, request.path)
        return {"error": "Invalid or expired token"}, 401
    return None


from app.api import alerts, auth, branches, errors, fridges, health, readings, thresholds  # noqa: E402,F401  registers routes
