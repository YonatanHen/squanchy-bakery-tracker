import os


class Config:
    """App settings read from the environment, with local development defaults."""

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql+psycopg://squanchy:squanchy@localhost:5432/squanchy_bakery"
    )
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me-at-least-32-bytes")
    JWT_EXPIRES_MINUTES = int(os.environ.get("JWT_EXPIRES_MINUTES", "480"))
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
