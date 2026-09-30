from typing import TYPE_CHECKING

from sqlalchemy import Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import db

if TYPE_CHECKING:
    from app.models.fridge import Fridge


class Branch(db.Model):
    """A bakery branch; the address is optional and tells apart two branches in one city."""

    __tablename__ = "branch"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    street: Mapped[str | None] = mapped_column(String(200))
    building_number: Mapped[str | None] = mapped_column(String(20))  # text, not int: "12a", "12b"

    fridges: Mapped[list["Fridge"]] = relationship(
        back_populates="branch", cascade="all, delete-orphan", passive_deletes=True
    )


Index("uq_branch_name_lower", func.lower(Branch.name), unique=True)
