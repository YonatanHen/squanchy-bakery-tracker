class NotFoundError(Exception):
    """A requested row does not exist; the API layer turns it into 404."""


class ConflictError(Exception):
    """A write conflicts with existing data; the API layer turns it into 409, on `field` when given."""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


def get_or_raise(session, model, row_id):
    """Return the row with this primary key, or raise NotFoundError."""
    row = session.get(model, row_id)
    if row is None:
        raise NotFoundError(f"{model.__name__} {row_id} not found")
    return row
