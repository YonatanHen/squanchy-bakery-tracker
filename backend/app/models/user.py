from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from werkzeug.security import check_password_hash, generate_password_hash

from app.db import db


class User(db.Model):
    """An app user; only a salted password hash is stored, never the password."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    def set_password(self, password: str) -> None:
        """Hash the password and store the hash."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Return True if the password matches the stored hash."""
        return check_password_hash(self.password_hash, password)
