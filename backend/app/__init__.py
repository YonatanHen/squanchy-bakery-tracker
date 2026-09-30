import logging

from flask import Flask

from app.config import Config
from app.db import db


def create_app(overrides: dict | None = None) -> Flask:
    """Create the Flask app with the database, logging and the versioned API.

    Args:
        overrides: Config values that replace the defaults, e.g. the test database URI.

    Returns:
        The configured Flask app.
    """
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    logging.basicConfig(level=app.config["LOG_LEVEL"], format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db.init_app(app)

    from app import models  # noqa: F401  registers tables
    from app.services import archive, thresholds  # noqa: F401  registers the archive and default-profile hooks
    from app.api import api_v1

    app.register_blueprint(api_v1)
    return app
