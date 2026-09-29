from flask import Flask


def create_app() -> Flask:
    app = Flask(__name__)

    from app.api import api_v1

    app.register_blueprint(api_v1)
    return app
