# Upload file format

The Upload page (currently) accepts **`.xlsx`** (Excel) and **`.csv`** files. Both use the same five columns and the same rules. `sample_week.xlsx` in this folder is a valid example.

## Columns

The first row is the header. Columns are matched **by name, not position**: they can be in any order, names are case-insensitive, and extra spaces are ignored. Other columns are ignored.

| Column   | Required | Accepted values | Example |
|----------|----------|-----------------|---------|
| `Logger` | yes | `TL-` and 4 digits (any case) | `TL-0512` |
| `Branch` | yes | A registered branch name (any case) | `Jerusalem` |
| `Fridge` | yes | The fridge name in that branch | `Dairy` |
| `Time`   | yes | `YYYY-MM-DD HH:MM` or `DD/MM/YYYY HH:MM` (24-hour); in `.xlsx` also a date-time cell | `2026-09-14 06:00`, `14/09/2026 06:00` |
| `Temp`   | yes | A number with a `.` decimal point, or `ERR` when the logger failed | `3.8`, `38.3`, `ERR` |

- **Temp** is in the fridge's own unit, as set on the Branches page (°C, or °F for Haifa). The file has no unit column; the app converts only for display and alerts.
- A header with a missing column rejects the whole file (422, listing the missing columns).
- Empty rows are skipped. A row with an empty or invalid cell is rejected with its row number; the valid rows are still saved.

## `.xlsx`

- Only the **first sheet** is read; row 1 is the header.
- The file must really be an Excel workbook (a CSV renamed to `.xlsx` is rejected with 415).

```
| Logger  | Branch        | Fridge      | Time             | Temp |
|---------|---------------|-------------|------------------|------|
| TL-0512 | Jerusalem     | Dairy       | 2026-09-14 06:00 | 3.8  |
| TL-0231 | Haifa         | Dairy       | 14/09/2026 06:00 | 38.3 |
| TL-0231 | Haifa         | Dairy       | 14/09/2026 06:30 | ERR  |
```

## `.csv`

- Encoding: **UTF-8** (Excel: *Save As → CSV UTF-8*). Other encodings, such as Windows-1255, are rejected with 400.
- Delimiter: `,` or `;` (detected from the header line). With `;`, still write decimals with `.` (`3.8`, not `3,8`).
- A row with fewer fields than the header is read with the missing fields empty, and is rejected as invalid.

```csv
Logger,Branch,Fridge,Time,Temp
TL-0512,Jerusalem,Dairy,2026-09-14 06:00,3.8
TL-0231,Haifa,Dairy,14/09/2026 06:00,38.3
TL-0231,Haifa,Dairy,14/09/2026 06:30,ERR
```

## What happens on upload

- **Duplicates:** a row with the same logger and time as a saved reading (or an earlier row in the file) is skipped and counted, not saved twice.
- **Unknown branches and loggers:** the app lists them and asks the user to confirm adding them (for a new logger, also the fridge and its unit), then saves the file again.
- **Moved logger:** a known logger with a new fridge name in the same branch renames that fridge (e.g. `Walk-in` → `Display 2`).
- **Alerts:** the fridge's threshold settings are checked on the saved readings, and the result lists how many alerts were added.
