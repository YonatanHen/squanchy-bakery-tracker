class NotFoundError(Exception):
    """A requested row does not exist; the API layer turns it into 404."""


def get_or_raise(session, model, row_id):
    """Return the row with this primary key, or raise NotFoundError."""
    row = session.get(model, row_id)
    if row is None:
        raise NotFoundError(f"{model.__name__} {row_id} not found")
    return row
