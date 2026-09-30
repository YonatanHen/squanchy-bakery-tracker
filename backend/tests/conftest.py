import os

import pytest
from sqlalchemy import text

from app import create_app
from app.db import db

TEST_DB = os.environ["TEST_DATABASE_URL"]  # loaded from backend/.env by app.config


@pytest.fixture
def app():
    """App bound to a fresh test database for each test."""
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": TEST_DB, "JWT_SECRET": "test-secret-at-least-32-bytes-long!"})
    with app.app_context():
        # Drop the whole schema, not only known tables: there are no migrations, and old tables would block drop_all.
        with db.engine.begin() as connection:
            connection.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
        db.create_all()
        yield app
        db.session.remove()


@pytest.fixture
def client(app):
    """HTTP test client for the app."""
    return app.test_client()


@pytest.fixture
def session(app):
    """Database session of the test app."""
    return db.session


@pytest.fixture
def auth_headers(app):
    """Authorization header with a valid admin token."""
    from app.services.tokens import create_token

    return {"Authorization": f"Bearer {create_token('admin')}"}
