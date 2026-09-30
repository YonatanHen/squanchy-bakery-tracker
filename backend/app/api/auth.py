from flask import request
from pydantic import BaseModel, Field

from app.api import api_v1
from app.db import db
from app.services.auth import authenticate


class LoginIn(BaseModel):
    """Login request body."""

    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


@api_v1.post("/auth/login")
def login():
    """Return a JWT for valid credentials, 401 otherwise."""
    data = LoginIn.model_validate(request.get_json(silent=True) or {})
    token = authenticate(db.session, data.username, data.password)
    if token is None:
        return {"error": "Invalid username or password"}, 401
    return {"access_token": token}
