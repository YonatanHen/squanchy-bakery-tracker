from sqlalchemy import Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import db


class Branch(db.Model):
    """A bakery branch; the address is optional and tells apart two branches in one city."""

    __tablename__ = "branch"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    street: Mapped[str | None] = mapped_column(String(200))
    building_number: Mapped[str | None] = mapped_column(String(20))  # text, not int: "12a", "12b"


Index("uq_branch_name_lower", func.lower(Branch.name), unique=True)
