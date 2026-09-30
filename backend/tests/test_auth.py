from app.models import User
from app.seed import seed_admin


def test_admin_password_is_stored_hashed_and_seed_is_idempotent(session):
    """The seeded admin's password is never stored in plain text, and seeding twice adds no second user."""
    seed_admin(session)
    seed_admin(session)

    users = session.query(User).all()
    assert len(users) == 1
    assert users[0].password_hash != "password"
    assert users[0].check_password("password")
    assert not users[0].check_password("wrong")
