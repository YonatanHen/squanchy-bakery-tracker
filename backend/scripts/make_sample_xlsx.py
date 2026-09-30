"""Write data/sample_week.xlsx from the assignment's sample rows. Run: python -m scripts.make_sample_xlsx"""
from pathlib import Path

from openpyxl import Workbook

from app.seed import SAMPLE_HEADER, SAMPLE_ROWS


def main() -> None:
    """Write the 16 sample rows to data/sample_week.xlsx at the repository root."""
    target = Path(__file__).resolve().parents[2] / "data" / "sample_week.xlsx"
    target.parent.mkdir(exist_ok=True)
    workbook = Workbook()
    workbook.active.append(SAMPLE_HEADER)
    for row in SAMPLE_ROWS:
        workbook.active.append(row)
    workbook.save(target)
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
