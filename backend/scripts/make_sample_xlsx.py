"""Write data/dummy_upload.xlsx from the assignment's sample rows. Run: python -m scripts.make_sample_xlsx"""
from pathlib import Path

from openpyxl import Workbook

HEADER = ["Logger", "Branch", "Fridge", "Time", "Temp"]

# The 16 rows from the assignment, unchanged.
ROWS = [
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:00", 3.8],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 06:00", 4.1],
    ["TL-0231", "Haifa", "Dairy", "14/09/2026 06:00", 38.3],
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:15", 3.9],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 06:15", 9.4],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:00", 4.6],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 06:30", 4.3],
    ["TL-0231", "Haifa", "Dairy", "14/09/2026 06:15", 39.0],
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 06:15", 3.9],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:15", 5.4],
    ["TL-0417", "Tel Aviv", "Walk-in", "2026-09-14 05:45", 4.0],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:30", 6.3],
    ["TL-0231", "Haifa", "Dairy", "14/09/2026 06:30", "ERR"],
    ["TL-0388", "Rishon LeZion", "Cream cakes", "2026-09-14 06:45", 7.1],
    ["TL-0512", "Jerusalem", "Dairy", "2026-09-14 08:30", 4.0],
    ["TL-0417", "tel aviv", "Display 2", "2026-09-17 06:00", 3.7],
]


def main() -> None:
    """Write the 16 sample rows to data/dummy_upload.xlsx at the repository root."""
    target = Path(__file__).resolve().parents[2] / "data" / "dummy_upload.xlsx"
    target.parent.mkdir(exist_ok=True)
    workbook = Workbook()
    workbook.active.append(HEADER)
    for row in ROWS:
        workbook.active.append(row)
    workbook.save(target)
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
