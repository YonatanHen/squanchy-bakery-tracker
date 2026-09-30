import os
from pathlib import Path

from dotenv import load_dotenv

# Real environment variables win over backend/.env.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Config:
    """App settings read from the environment (backend/.env)."""

    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    JWT_SECRET = os.environ["JWT_SECRET"]
    JWT_EXPIRES_MINUTES = int(os.environ.get("JWT_EXPIRES_MINUTES", "480"))
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
