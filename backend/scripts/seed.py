"""Create the tables and the admin user. Run: python -m scripts.seed

Branches, fridges, loggers and readings are not seeded: upload data/sample_week.xlsx and add them from the app.
"""
import os

from app import create_app
from app.db import db
from app.seed import seed_admin


def main() -> None:
    """Create tables and the admin user."""
    app = create_app()
    with app.app_context():
        db.create_all()
        seed_admin(db.session, os.environ["ADMIN_USERNAME"], os.environ["ADMIN_PASSWORD"])
    print("Created tables and the admin user.")


if __name__ == "__main__":
    main()
