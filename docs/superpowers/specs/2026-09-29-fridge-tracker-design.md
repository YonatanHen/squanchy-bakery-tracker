# Squanchy Bakery Fridge Tracker — Design Spec

Date: 2026-09-29
Sources: `docs/manually-written-docs/initial design decisions.md`, `docs/manually-written-docs/squancy bakery erd.drawio.png`, `CLAUDE.md`.

## 1. Problem

Summer runs operations for Squanchy Bakery. Every week, branch managers email her the files of the temperature loggers inside their fridges. She pastes them into one Excel sheet and looks for problems by hand. She still misses things:

- She cannot answer the Ministry of Health inspector: "when did this fridge go above X degrees, and for how long?"
- A fridge in Rishon warmed slowly for two days and nobody noticed.
- The data is messy: one logger (Haifa) reports in Fahrenheit, columns move, date formats differ, readings show `ERR`, rows repeat, readings are missing for hours, and a logger was moved to a new display fridge.

She works from her phone most of the day.

## 2. Goals

1. Upload the weekly data and store it validated and normalized.
2. See all readings and all alerts in one place, mobile-first.
3. Answer the inspector with filters on date range and temperature range (any threshold, not a fixed number).
4. Get deterministic alerts on warming trends, spikes, deviation from the fridge average (too warm or too cold), and missing readings.
5. Register branches, fridges and loggers from the readings themselves, so every upload is checked against known data without a setup step.

Constraint: runs on a laptop from the README, with no accounts and no paid services.

## 3. Out of scope

- LLM features (alert agent, weekly summary, free-text questions). Planned for later.
- Deployment to a server.
- Roles and permissions beyond one admin user.
- React Native app (the web app is mobile-first instead).
- CI/CD.
- Playwright E2E tests.
- Database migrations tool (`create_all` + seed script).
- Parsers other than Excel (the parser pattern is ready for them).

## 4. Architecture

| Layer | Choice |
|---|---|
| Database | PostgreSQL 16 in Docker Compose (`squanchy_bakery`, `squanchy_bakery_test`) |
| Backend | Python, Flask, SQLAlchemy, Pydantic v2 |
| Auth | JWT, users stored in the DB with hashed passwords |
| Frontend | React (Vite, TypeScript), mobile-first |
| Tests | pytest (backend), Vitest (frontend unit) |

All API routes are under `/api/v1/`.

```
docker-compose.yml
backend/app/            create_app, config, db, models/, schemas/, api/
backend/app/ingest/     parsers/base.py, factory.py, excel.py, normalizer.py, repository.py
backend/app/detection/  rules.py (pure functions), service.py
backend/scripts/seed.py
backend/tests/
data/sample_week.xlsx
frontend/
```

## 5. Data model

Based on the ERD, with the changes agreed during design.

| Table | Columns | Constraints |
|---|---|---|
| `branch` | id, name, city, street, building_number | unique `LOWER(name)`; street and building_number nullable for every branch |
| `fridge` | id, branch_id, name, metric (C/F, default C), avg_temp, last_measured | unique (branch_id, `LOWER(name)`); cascade from branch |
| `logger` | id (`TL-NNNN`), fridge_id | fridge_id unique (1-to-1); cascade from fridge |
| `reader` | id, logger_id, time, temp, metric, status (OK/ERR) | unique (logger_id, time); `temp` NULL only when status is ERR; no delete cascade (archived) |
| `alerts` | id, reader_id, description, level (URGENT/NON_URGENT) | no delete cascade (archived) |
| `reader_archive`, `alert_archive` | archived readings (with branch and fridge names) and their alerts, `archived_at` | filled automatically before any delete |
| `threshold_settings` | id, name, 6 threshold values | named threshold settings shared by many fridges; unique `LOWER(name)`; new fridges use `default` (suggested values, created on first use); cannot be deleted while fridges use it |
| `fridge.threshold_settings_id` | FK to `threshold_settings` | one threshold settings row, many fridges (e.g. the same limits for all dairy fridges across branches) |
| `users` | id, username, password_hash | unique username |

Rules:
- A reading keeps its original value and metric. The fridge is a third-party device, so its unit is stored as a fridge setting. Haifa Dairy is F, all other fridges are C. The UI converts on request.
- One logger per fridge and one fridge per logger. A known logger with a new fridge name in the same branch means the fridge changed its display name (TL-0417: Walk-in → Display 2). The fridge is renamed.
- Only the 4 known branches are seeded (Jerusalem, Tel Aviv, Haifa, Rishon LeZion). New branches, fridges and loggers are registered from readings (see section 6, Registration).
- The branch address (street + building number) was not requested by Summer. It tells apart two branches in the same city. It is optional and can be added later.

## 6. Ingestion

```
upload → ParserFactory → ExcelParser → RawRow[]
       → Normalizer → Validator (Pydantic) → ReadingRepository.save_many() → DB
       → detection service → alerts
```

- **Parsers (Strategy + Factory).** `ReadingParser` protocol with `can_parse(filename, head)` and `parse(stream)`. The factory checks the file content, not only the extension. Only `ExcelParser` is implemented. It maps columns by header name, so column order does not matter.
- **Single record.** `POST /api/v1/readings` accepts one JSON record and uses the same normalizer, validator and repository.
- **Normalizer.** Trims and collapses spaces. Looks up branch, fridge and logger case-insensitively, and the stored name wins ("tel aviv" → "Tel Aviv"). Accepted date formats: `YYYY-MM-DD HH:MM`, `DD/MM/YYYY HH:MM`, and Excel datetime cells. `ERR` becomes status ERR with no temperature.
- **Validator.** Every field has Pydantic rules. Row errors: empty field ("... is required"), unknown branch, unknown logger, logger id not matching `TL-NNNN`, malformed date, temperature that is not a number or `ERR`. The validator collects the errors of all rows.
- **Registration (no onboarding step).** An unknown branch or logger is a row error, and the response also returns them grouped under `unknown`. Empty values are never listed as unknown. A branch gets the closest registered name (`difflib`, similarity ≥ 0.8): "Branch X does not exist. Did you mean Y? / Add it?". A logger gets no suggestion, because similar IDs (TL-0512, TL-0513) are usually different loggers, and a branch can have several similar fridges: "Logger X does not exist. Add it / Edit it before adding?". Adding a branch asks for its city (address optional); adding a logger asks for its fridge name and metric, and all fields can be edited before adding. The UI then re-sends the same file or record with a `register` block. The new entities are created in the same transaction as the valid rows; an invalid `register` block rejects the request (422).
- **Repository (partial upload).** One transaction per upload. Valid rows are saved; invalid rows are skipped and returned with their file row so the user can fix them and re-upload the same file. Rows already saved count as duplicates on the re-upload. The result reports inserted, duplicates, ERR rows, rejected rows, renamed fridges and the errors. Only file-level problems reject the whole file: unsupported format (415) or missing columns (422).

Upload response (HTTP 201):
```json
{ "inserted": 12, "duplicates": 1, "err_rows": 1, "rejected": 1, "renamed_fridges": [], "alerts": 0,
  "errors": [ { "row": 7, "field": "branch", "value": "Eilat", "message": "Unknown branch name" } ],
  "unknown": { "branches": [ { "name": "Eilat", "suggestion": null } ],
               "loggers": [ { "logger": "TL-0600", "branch": "Eilat", "fridge": "Dairy" } ] } }
```

## 7. Alert detection

Deterministic rules in code. The thresholds come from the fridge's threshold settings (`fridge.threshold_settings`) and are compared in °C. Values of an F fridge are converted in memory.

| Rule | Non-urgent (default) | Urgent (default) |
|---|---|---|
| Growth: last 4 OK readings, no step goes down | total ≥ 0.1° | total ≥ 1.0° |
| Deviation from `fridge.avg_temp` (average before the reading is added), above or below | ≥ 1.5° | ≥ 3.0° |
| Gap between consecutive readings | > 15 min | ≥ 120 min |

- **Spike:** a reading that deviates from the average while the next reading is back within the non-urgent deviation (e.g. a door opened for a delivery). A spike creates a NON_URGENT alert (light alert in the UI).
- A spike reading is stored and visible in the readings table, but it is not added to `avg_temp`, so normal readings after it do not look too cold.
- A deviating reading that is the last one of its fridge in the upload cannot be classified as a spike yet. It is evaluated as a deviation.
- Readings are sorted by time before evaluation.
- ERR readings are stored and skipped by the growth and deviation rules.
- The gap rule runs on the uploaded data, not against the current time, because data arrives weekly.
- After saving, `avg_temp` and `last_measured` are updated for each fridge.
- Non-urgent alerts appear as light alerts in the UI.

Expected results on `data/sample_week.xlsx` (the 16 sample rows from the assignment):
- Rishon Cream cakes (4.6 → 5.4 → 6.3 → 7.1): growth URGENT, deviation NON_URGENT at 06:45.
- Tel Aviv Walk-in 9.4 at 06:15: spike, NON_URGENT alert, not added to the average. 4.3 at 06:30 and 3.7 on 09-17 create no deviation alert (average ≈ 4.1).
- Jerusalem Dairy 06:15 → 08:30: gap URGENT. The duplicate 06:15 row is skipped.
- Tel Aviv 06:30 → Display 2 on 09-17: gap URGENT.
- Haifa: 38.3 and 39.0 stored as °F. The ERR row is stored.

## 8. API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Health check (no auth) |
| POST | `/api/v1/auth/login` | Returns a JWT |
| GET | `/api/v1/readings` | Filters: date_from, date_to, temp_min, temp_max (+ unit, default C), branch, city, street, building_number, fridge, logger_id, status, metric. Offset pagination |
| POST | `/api/v1/readings/upload` | Excel upload; optional `register` field with confirmed new entities |
| POST | `/api/v1/readings` | Single record; optional `register` block |
| PATCH / DELETE | `/api/v1/readings/<id>` | Edit or delete a reading; `avg_temp` recalculated |
| GET | `/api/v1/alerts` | Location and date filters + level |
| GET | `/api/v1/branches` | List with fridges and loggers |
| PATCH / DELETE | `/api/v1/branches/<id>` | Edit name, city, address; delete |
| PATCH / DELETE | `/api/v1/fridges/<id>` | Edit or delete a fridge with its logger |
| GET | `/api/v1/branches/<id>/delete-impact`, `/api/v1/fridges/<id>/delete-impact` | Read-only counts of what a delete would remove |
| GET / POST | `/api/v1/threshold-settings` | List threshold settings with fridge counts; create named threshold settings |
| PUT / DELETE | `/api/v1/threshold-settings/<id>` | Edit threshold settings (affects every fridge using them; UI confirms); delete unused ones (409 if in use) |

Every route except health and login needs a valid JWT. Missing or invalid token → 401.

**Delete flow.** The UI first calls `delete-impact`, which deletes nothing and returns counts, e.g. `{fridges: 2, loggers: 2, readings: 1340, alerts: 12}`. The confirmation dialog shows the counts. After Summer confirms, `DELETE` removes the item; its readings and alerts are moved to the archive tables in the same transaction, so an accidental delete or an inspector question can still be answered. `GET /api/v1/alerts?archived=true` lists archived alerts.

**Edit flow.** Edits update rows in place and are not archived; the UI asks "Are you sure?" before saving.

**Server logs.** Process states (INFO), rejected input (WARNING, no values) and errors (ERROR) are logged; passwords, tokens and file contents never are.

## 9. Frontend

Screens: login, readings (filters, pagination, C/F toggle), alerts (light style for non-urgent), upload (file + single record, result and errors, "did you mean / add it?" confirmation for unknown branches and loggers), branches (list, edit, delete with counts; no creation screen), thresholds (pick a fridge, edit its values).
Mockups of every screen at phone width are reviewed and approved before any frontend code.

## 10. Testing

- TDD for every step: failing test first, then code.
- pytest runs against `squanchy_bakery_test`.
- Tests trace to a requirement or a known data problem: duplicates, ERR, Fahrenheit, mixed dates, gaps, moved logger, unknown names, malformed values.
- Vitest covers the C/F converter.

## 11. Questions for Summer before going live

- Which temperature limit does the inspector use? Is it the same for every product?
- What are the names of the other 8 branches, and how many fridges does each branch have?
- What happens when a logger moves to a different fridge (not a display rename)?
- Does the Haifa logger record in Fahrenheit? Do other loggers?
- Do all loggers record every 15 minutes?
- In which file format does each logger export?
- Do the loggers record door or battery data anywhere?
