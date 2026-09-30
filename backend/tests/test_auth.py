from app.models import User
from app.seed import seed_admin
from app.services.tokens import decode_token


def test_admin_password_is_stored_hashed_and_seed_is_idempotent(session):
    """The seeded admin's password is never stored in plain text, and seeding twice adds no second user."""
    seed_admin(session)
    seed_admin(session)

    users = session.query(User).all()
    assert len(users) == 1
    assert users[0].password_hash != "password"
    assert users[0].check_password("password")
    assert not users[0].check_password("wrong")


def test_login_with_valid_credentials_returns_token(client, session):
    """Summer logs in and gets a JWT for her username."""
    seed_admin(session)

    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "password"})

    assert response.status_code == 200
    assert decode_token(response.get_json()["access_token"]) == "admin"


def test_login_with_wrong_password_returns_401_and_logs_no_password(client, session, caplog):
    """A failed login is logged as a warning, without the password that was tried."""
    seed_admin(session)

    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "nope-secret"})

    assert response.status_code == 401
    assert any(r.levelname == "WARNING" and "Login failed" in r.getMessage() for r in caplog.records)
    assert "nope-secret" not in caplog.text


def test_login_with_missing_fields_returns_422_with_field_errors(client):
    """Empty or missing username and password are reported per field."""
    response = client.post("/api/v1/auth/login", json={"username": ""})

    assert response.status_code == 422
    fields = {e["field"] for e in response.get_json()["errors"]}
    assert fields == {"username", "password"}
