import io

from openpyxl import Workbook
from sqlalchemy import func, select

from app.models import Branch, Fridge, Logger, Metric


def xlsx_bytes(header, rows) -> bytes:
    """Build an .xlsx file in memory with a header row and data rows."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(list(header))
    for row in rows:
        sheet.append(list(row))
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def load_sample(session):
    """Seed the 4 sample fridges and ingest the assignment's 16 rows through the Excel parser."""
    from app.seed import SAMPLE_HEADER, SAMPLE_ROWS, seed_sample_fridges
    from app.services.ingest.parsers.excel import ExcelParser
    from app.services.ingest.service import ingest_rows

    seed_sample_fridges(session)
    rows = ExcelParser().parse(io.BytesIO(xlsx_bytes(SAMPLE_HEADER, SAMPLE_ROWS)))
    return ingest_rows(session, rows)


def add_fridge(session, branch="Jerusalem", fridge="Dairy", logger="TL-0512", metric=Metric.C) -> Fridge:
    """Create a fridge (and its branch if missing) with one logger."""
    existing = session.scalar(select(Branch).where(func.lower(Branch.name) == branch.lower()))
    new_fridge = Fridge(branch=existing or Branch(name=branch, city=branch), name=fridge, metric=metric)
    if logger:
        new_fridge.logger = Logger(id=logger)
    session.add(new_fridge)
    session.commit()
    return new_fridge
