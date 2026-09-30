import os

import pytest

from app import create_app
from app.db import db

TEST_DB = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://squanchy:squanchy@localhost:5432/squanchy_bakery_test"
)


@pytest.fixture
def app():
    """App bound to a fresh test database for each test."""
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": TEST_DB, "JWT_SECRET": "test-secret"})
    with app.app_context():
        db.drop_all()
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
