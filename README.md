# Squanchy Bakery Fridge Tracker

A web app for the bakery's fridge temperature loggers. Branch managers send weekly logger files; the app reads them, cleans and validates them, stores every reading, raises alerts, and answers questions like *"when did this fridge go above 5°C, and for how long?"* — from a phone or a desktop.

## Quick start (whole app in Docker)

Prerequisites: Git and **Docker Desktop**.

```bash
git clone https://github.com/YonatanHen/squanchy-bakery-tracker.git
cd squanchy-bakery-tracker
cp .env.example .env    # set POSTGRES_PASSWORD, JWT_SECRET (at least 32 characters) and ADMIN_PASSWORD
docker compose up -d --build --wait
```

Open **http://localhost:8080** and log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`.

All settings and secrets are in this one `.env` file at the repo root (git-ignored; `.env.example` lists every key). Docker Compose and the backend both read it.

This starts PostgreSQL, the backend (gunicorn; it creates the tables and the admin user on start) and the frontend (nginx, which also proxies `/api` to the backend). To start again from an empty database: `docker compose down -v`.

### Try it

1. **Upload** → choose `data/sample_week.xlsx` (the 16 sample rows from Summer's email).
2. The database is empty, so the app lists the 4 branches and 4 loggers as unknown. **Add them**: give each branch its city, and set the Haifa logger (TL-0231) to **°F**.
3. The result: 15 readings saved, 1 duplicate skipped, 1 `ERR` reading, 5 alerts, and Tel Aviv *Walk-in* renamed to *Display 2* (the logger moved to the new display fridge).
4. **Alerts** → Rishon LeZion *Cream cakes* above 5°C, with the period and its duration; the Tel Aviv one-reading jump as non-urgent.
5. **Readings** → filters for the inspector: branch, fridge, date range and a temperature range (for example *Min 5 °C*). The °C/°F toggle converts the view.
6. **Thresholds** and **Branches** → change the limits, move a fridge to other threshold settings, edit or delete (deleted history goes to the archive and can be restored from Readings → Archived).

The upload accepts `.xlsx` and `.csv`; see [`data/FILE_FORMAT.md`](data/FILE_FORMAT.md).

## Screens

With the sample week loaded. More in [`screenshots/`](screenshots/).

**Phone** (mobile first)

| Readings | Alerts | Upload | Add a reading |
|---|---|---|---|
| <img src="screenshots/phone-readings.png" width="200"> | <img src="screenshots/phone-alerts.png" width="200"> | <img src="screenshots/phone-upload.png" width="200"> | <img src="screenshots/phone-add-reading.png" width="200"> |

**Desktop** (from 900px wide)

| Readings | Alerts |
|---|---|
| ![Readings](screenshots/desktop-readings.png) | ![Alerts](screenshots/desktop-alerts.png) |

| Upload: rows to fix and unregistered entries | "Add it?" for a new branch and logger |
|---|---|
| ![Upload](screenshots/desktop-upload.png) | ![Add it](screenshots/desktop-add-it.png) |

| Branches | Thresholds |
|---|---|
| ![Branches](screenshots/desktop-branches.png) | ![Thresholds](screenshots/desktop-thresholds.png) |

## Approach

- **One place for all readings.** Upload a file (or type one reading). Valid rows are saved; invalid rows are listed with their file row number so the user can fix the file and upload it again. Rows that were already saved are skipped as duplicates.
- **Messy data is normalized, not guessed.** Columns are found by name, in any order. Two date formats and Excel date cells are accepted; branch, fridge and logger names match in any case and spacing; `ERR` is stored as a reading without a temperature; every empty field is a clear row error.
- **Branches, fridges and loggers are registered from the data.** An unknown branch or logger in a file is never created silently: the upload lists it ("did you mean *Rishon LeZion*?" for a branch typo), and after the user confirms, it is created together with the readings.
- **Units are kept as measured.** The unit is a fridge setting; a Fahrenheit logger's readings are stored in °F. They are converted to °C only for the alert rules and filters, and shown in either unit.
- **Deterministic alerts, configurable thresholds.** Rules in code, not a model:
  - **limit** — one alert per period outside the fridge's min/max, with start, end and duration. One reading outside (a door opening) is non-urgent; two or more are urgent.
  - **growth** — a steady rise over the last readings (a fridge that is slowly warming up).
  - **gap** — no reading for longer than the gap thresholds, checked in the uploaded data.

  The limits come from named **threshold settings** shared by many fridges (e.g. the same limits for every dairy fridge). New fridges use "default" (0–5°C).
- **Nothing is lost by accident.** Deleting a branch, fridge or reading moves its readings and alerts to archive tables in the same transaction; an archived reading can be restored. Edits change a reading in place (the UI asks "Are you sure?") and re-run the alert rules.
- **Mobile first.** One responsive React app: bottom navigation and cards on a phone, a sidebar and tables from 900px.

## Architecture

```mermaid
flowchart LR
    UI["Web app<br/>(React, mobile first;<br/>nginx in Docker)"] -->|"JSON over HTTP<br/>JWT"| API
    subgraph Backend["Flask backend (gunicorn)"]
        API["api/v1 routes<br/>(thin: validate, call, respond)"] --> SVC
        subgraph SVC["services (business logic)"]
            ING["ingest:<br/>parser factory → .xlsx / .csv parser →<br/>Pydantic row validation →<br/>repository"]
            DET["detection:<br/>limit · growth · gap"]
            ARC["archive on delete, restore"]
            THR["threshold settings"]
        end
        SVC --> MOD["models (SQLAlchemy)"]
    end
    MOD --> DB[("PostgreSQL 16")]
    ING --> DET
```

- **Layers:** `app/api` (routes) → `app/services` (business logic) → `app/models` (one model per file). Request, response and file-row validation uses Pydantic models in `app/schemas` and `app/services/ingest/schemas.py`.
- **Upload pipeline:** a parser is picked by the file's content, not only its extension (Strategy + Factory; `.xlsx` and `.csv`). Rows are validated against the registered branches, fridges and loggers, saved by one repository (the single write path for readings), and then the detection rules run for the affected fridges.
- **Frontend:** screens are built from shared base components in `frontend/src/components/` (Field, Combobox, Button, Dialog, DataTable, ...), styled only with design tokens from `src/index.css`.
- **Auth:** one admin user with a hashed password; every route except login and health needs a JWT.
- **Logs:** process states and errors are logged; passwords, tokens and file contents never are.

## Data model (ERD)

```mermaid
erDiagram
    BRANCH ||--o{ FRIDGE : has
    THRESHOLD_SETTINGS ||--o{ FRIDGE : "sets limits for"
    FRIDGE ||--o| LOGGER : "measured by"
    LOGGER ||--o{ READER : records
    READER ||--o{ ALERTS : raises
    READER_ARCHIVE ||--o{ ALERT_ARCHIVE : "kept with"

    BRANCH {
        int id PK
        string name "unique, any case"
        string city
        string street "optional"
        string building_number "optional, e.g. 12a"
    }
    FRIDGE {
        int id PK
        int branch_id FK
        int threshold_settings_id FK
        string name "unique per branch"
        enum metric "C or F"
        datetime last_measured
    }
    THRESHOLD_SETTINGS {
        int id PK
        string name "unique, e.g. default"
        float min_temp "°C"
        float max_temp "°C"
        float growth_non_urgent
        float growth_urgent
        int gap_non_urgent_minutes
        int gap_urgent_minutes
    }
    LOGGER {
        string id PK "TL-NNNN"
        int fridge_id FK "unique: one logger per fridge"
    }
    READER {
        int id PK
        string logger_id FK
        datetime time "unique with logger_id"
        float temp "null when status is ERR"
        enum metric "C or F, the fridge's unit"
        enum status "OK or ERR"
    }
    ALERTS {
        int id PK
        int reader_id FK
        string description
        enum level "URGENT or NON_URGENT"
        enum kind "GAP, GROWTH or LIMIT"
    }
    READER_ARCHIVE {
        int id PK "original reading id"
        string logger_id
        string branch "name at delete time"
        string fridge "name at delete time"
        datetime time
        float temp
        enum metric
        enum status
        datetime archived_at
    }
    ALERT_ARCHIVE {
        int id PK "original alert id"
        int reader_id "reading in READER_ARCHIVE"
        string description
        enum level
        enum kind
        datetime archived_at
    }
    USERS {
        int id PK
        string username "unique"
        string password_hash
    }
```

## Tech stack

| Part | Choice |
|---|---|
| Backend | Python 3.12+ (developed on 3.14), Flask 3.1, SQLAlchemy 2 (Flask-SQLAlchemy), Pydantic 2, PyJWT, openpyxl; gunicorn in Docker |
| Database | PostgreSQL 16 (Docker Compose, or a local install) |
| Frontend | React 19 + TypeScript (strict), Vite, React Router, CSS Modules; nginx in Docker |
| Tests | pytest against a separate test database; Vitest + Testing Library |

## Run without Docker (development)

Prerequisites: Git, Python 3.12+, Node 22, and either **Docker Desktop** (for the database only) or a local **PostgreSQL 16**.

Commands are for Git Bash, macOS or Linux. On Windows, the virtualenv's Python is `.venv/Scripts/python`; on macOS/Linux it is `.venv/bin/python`.

First create the settings file at the repo root:

```bash
cp .env.example .env        # set POSTGRES_PASSWORD, JWT_SECRET (at least 32 characters) and ADMIN_PASSWORD
```

Required: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_TEST_DB`, `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. Optional: `JWT_EXPIRES_MINUTES` (default 480), `LOG_LEVEL` (default `INFO`). `DATABASE_URL` and `TEST_DATABASE_URL` are built from the `POSTGRES_*` values, so the password is written once. Real environment variables override the file.

### 1. The database

**Option A — Docker, database only**

```bash
docker compose up -d --wait db
```

This starts PostgreSQL on `localhost:5432` with the user, password and database names from `.env` (`POSTGRES_TEST_DB` is the test database). The init script runs only when the volume is new: after changing these values, reset the volume with `docker compose down -v`.

**Option B — a local PostgreSQL 16, without Docker**

1. Install PostgreSQL 16 (for example `winget install PostgreSQL.PostgreSQL.16` on Windows, the EDB installer, or your package manager).
2. Stop the Docker database if it runs (`docker compose down`), or install PostgreSQL on another port — both use 5432.
3. Create the user and the two databases (in `psql -U postgres`):
   ```sql
   CREATE ROLE squanchy LOGIN PASSWORD 'squanchy';
   CREATE DATABASE squanchy_bakery OWNER squanchy;
   CREATE DATABASE squanchy_bakery_test OWNER squanchy;
   ```
4. In `.env`, set `POSTGRES_PASSWORD=squanchy`; the other `POSTGRES_*` values already match these names. With your own server, host or port, change the URLs in `.env`:
   ```bash
   DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DB_NAME
   TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/TEST_DB_NAME
   ```

The database must be PostgreSQL; SQLite is not supported.

### 2. The backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m scripts.seed                       # creates the tables and the admin user
.venv/Scripts/python -m flask --app app run                # API on http://127.0.0.1:5000
```

The backend reads the `.env` at the repo root.

### 3. The frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, /api is proxied to the backend on :5000
```

### 4. Run the tests

```bash
cd backend && .venv/Scripts/python -m pytest    # uses squanchy_bakery_test and resets it for every test
cd frontend && npm test
```

### 5. API only (optional, with curl)

On an empty database, the first upload saves nothing and lists the 4 branches and 4 loggers as unknown; confirming them (the `register` field, which the UI sends after "add it?") saves the rows.

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 1) Upload: 16 rows rejected, "unknown" lists the branches and loggers to add
curl -s -X POST http://127.0.0.1:5000/api/v1/readings/upload \
  -H "Authorization: Bearer $TOKEN" -F "file=@data/sample_week.xlsx"
```

Save the confirmation as `register.json`:

```json
{
  "branches": [
    {"name": "Jerusalem", "city": "Jerusalem"},
    {"name": "Tel Aviv", "city": "Tel Aviv"},
    {"name": "Haifa", "city": "Haifa"},
    {"name": "Rishon LeZion", "city": "Rishon LeZion"}
  ],
  "fridges": [
    {"logger_id": "TL-0512", "branch": "Jerusalem", "fridge": "Dairy"},
    {"logger_id": "TL-0417", "branch": "Tel Aviv", "fridge": "Walk-in"},
    {"logger_id": "TL-0231", "branch": "Haifa", "fridge": "Dairy", "metric": "F"},
    {"logger_id": "TL-0388", "branch": "Rishon LeZion", "fridge": "Cream cakes"}
  ]
}
```

```bash
# 2) Upload again with the confirmation: 15 inserted, 1 duplicate, 1 ERR, 5 alerts,
#    and "Tel Aviv: Walk-in -> Display 2" (the logger moved to a new display fridge)
curl -s -X POST http://127.0.0.1:5000/api/v1/readings/upload \
  -H "Authorization: Bearer $TOKEN" -F "file=@data/sample_week.xlsx" -F "register=<register.json"
```

On PowerShell use `curl.exe` instead of `curl`. With the whole app in Docker, use `http://localhost:8080` instead of `http://127.0.0.1:5000`.

## API overview

All routes are under `/api/v1`. Every route except `GET /health` and `POST /auth/login` needs `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/login` | Get a token |
| POST | `/readings/upload` | Upload an `.xlsx` or `.csv` file (optional `register` field) |
| POST | `/readings` | Add one reading (optional `register` key) |
| GET | `/readings` | Query readings: branch, city, fridge, logger, date range, temperature range in any unit, paging; `?archived=true` for deleted readings |
| PATCH / DELETE | `/readings/<id>` | Correct a reading (time, temperature, logger) / delete it (archived) |
| DELETE | `/readings/archive` | Delete all archived readings and their alerts for good |
| POST | `/readings/archive/<id>/restore` | Restore one archived reading |
| GET | `/alerts` | Query alerts (level, location, dates); `?archived=true` for alerts of deleted readings |
| GET | `/branches` | Branches with their fridges and loggers |
| PATCH / DELETE | `/branches/<id>` | Edit name, city, address / delete (history archived) |
| PATCH / DELETE | `/fridges/<id>` | Edit name, unit, logger, threshold settings / delete (history archived) |
| GET | `/branches/<id>/delete-impact`, `/fridges/<id>/delete-impact` | Counts for the delete confirmation |
| GET / POST | `/threshold-settings` | List threshold settings (with how many fridges use each) / create one |
| PUT / DELETE | `/threshold-settings/<id>` | Edit threshold settings / delete unused ones |

## Project docs

- [`NOTES.md`](NOTES.md) — time spent, decisions, questions for Summer, what's not done, how I worked with AI tools.
- [`docs/manually-written-docs/`](docs/manually-written-docs/) — my own design decisions and ERD, written before any code.
- [`docs/superpowers/`](docs/superpowers/) — the design spec and the implementation plan.
- [`CLAUDE.md`](CLAUDE.md) — the rules for the AI tool (branches, TDD, validation, logging, components).
- [`data/FILE_FORMAT.md`](data/FILE_FORMAT.md) — the accepted upload files.
