from flask import Flask

from app.config import Config
from app.db import db


def create_app(overrides: dict | None = None) -> Flask:
    """Create the Flask app with the database and the versioned API.

    Args:
        overrides: Config values that replace the defaults, e.g. the test database URI.

    Returns:
        The configured Flask app.
    """
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    db.init_app(app)

    from app import archive, models  # noqa: F401  registers tables and the archive-on-delete hook
    from app.api import api_v1

    app.register_blueprint(api_v1)
    return app
