"""Create the tables, the admin user and the 4 known branches. Run: python -m scripts.seed"""
from app import create_app
from app.db import db
from app.seed import seed_admin, seed_sample_fridges


def main() -> None:
    """Create tables and seed the admin user and sample fridges."""
    app = create_app()
    with app.app_context():
        db.create_all()
        seed_admin(db.session)
        seed_sample_fridges(db.session)
    print("Seeded admin user and 4 branches.")


if __name__ == "__main__":
    main()
