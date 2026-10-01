import os
from pathlib import Path

from dotenv import load_dotenv

# The one .env at the repo root; real environment variables win over it.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Config:
    """App settings read from the environment (.env at the repo root)."""

    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    JWT_SECRET = os.environ["JWT_SECRET"]
    JWT_EXPIRES_MINUTES = int(os.environ.get("JWT_EXPIRES_MINUTES", "480"))
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
