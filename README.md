# Squanchy Bakery Fridge Tracker

A web app for the bakery's fridge temperature loggers. Branch managers send weekly logger files; the app reads them, cleans and validates them, stores every reading, raises alerts, and answers questions like *"when did this fridge go above 5°C, and for how long?"* — from a phone or a desktop.

> First version of this README. More sections (the frontend, decisions and trade-offs, what's not done) will follow.

## Approach

- **One place for all readings.** Upload the Excel file (or type one reading). Valid rows are saved; invalid rows are listed with their file row number so the user can fix the file and upload it again. Rows that were already saved are skipped as duplicates.
- **Messy data is normalized, not guessed.** Two date formats and Excel date cells are accepted; branch, fridge and logger names match in any case and spacing; `ERR` is stored as a reading without a temperature; every empty field is a clear row error.
- **Branches, fridges and loggers are registered from the data.** An unknown branch or logger in a file is never created silently: the upload lists it ("did you mean *Rishon LeZion*?" for a branch typo), and after the user confirms, it is created together with the readings.
- **Units are kept as measured.** A Fahrenheit logger's readings are stored in °F; they are converted to °C only for the alert rules and filters, and shown in either unit.
- **Deterministic alerts, configurable thresholds.** Rules in code, not a model: a gap in the readings, a steady rise over the last 4 readings, and a deviation from the fridge's average (too warm or too cold). A one-off spike that returns to normal gets a light alert and does not move the average. The limits come from named **threshold profiles** shared by many fridges (e.g. the same limits for every dairy fridge).
- **Nothing is lost by accident.** Deleting a branch, fridge or reading moves its readings and alerts to archive tables in the same transaction, so a later question can still be answered. Edits change a reading in place (the UI asks "Are you sure?") and re-run the alert rules on it.

## Architecture

```mermaid
flowchart LR
    UI["Web app<br/>(React, mobile first)"] -->|"JSON over HTTP<br/>JWT"| API
    subgraph Backend["Flask backend"]
        API["api/v1 routes<br/>(thin: validate, call, respond)"] --> SVC
        subgraph SVC["services (business logic)"]
            ING["ingest:<br/>parser factory → Excel parser →<br/>Pydantic row validation →<br/>repository"]
            DET["detection:<br/>gap · growth · deviation · spike"]
            ARC["archive on delete"]
            THR["threshold profiles"]
        end
        SVC --> MOD["models (SQLAlchemy)"]
    end
    MOD --> DB[("PostgreSQL 16")]
    ING --> DET
```

- **Layers:** `app/api` (routes) → `app/services` (business logic) → `app/models` (one model per file). Request, response and file-row validation uses Pydantic models in `app/schemas` and `app/services/ingest/schemas.py`.
- **Upload pipeline:** a parser is picked by the file's content, not only its extension (Strategy + Factory; only Excel is implemented). Rows are validated against the registered branches, fridges and loggers, saved by one repository (the single write path for readings), and then the detection rules run on the new readings.
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
        float avg_temp "in the fridge's unit"
        datetime last_measured
    }
    THRESHOLD_SETTINGS {
        int id PK
        string name "unique, e.g. default"
        float growth_non_urgent
        float growth_urgent
        float deviation_non_urgent
        float deviation_urgent
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
        enum metric "C or F, as measured"
        enum status "OK or ERR"
    }
    ALERTS {
        int id PK
        int reader_id FK
        string description
        enum level "URGENT or NON_URGENT"
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
| Backend | Python 3.12+ (developed on 3.14), Flask 3.1, SQLAlchemy 2 (Flask-SQLAlchemy), Pydantic 2, PyJWT, openpyxl |
| Database | PostgreSQL 16 (Docker Compose, or a local install) |
| Tests | pytest against a separate test database |
| Frontend | React + TypeScript (Vite), Vitest — in progress |

## Setup and run

Prerequisites: Git, Python 3.12+, and either **Docker Desktop** or a local **PostgreSQL 16**.

Commands are for Git Bash, macOS or Linux. On Windows, the virtualenv's Python is `.venv/Scripts/python`; on macOS/Linux it is `.venv/bin/python`.

### 1. The database

**Option A — Docker (default)**

```bash
cp .env.example .env        # then set POSTGRES_PASSWORD
docker compose up -d --wait
```

This starts PostgreSQL on `localhost:5432` with the user, password and database names from the root `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_TEST_DB` for the test database). The root `.env` is only for Docker Compose; keep the same user and password in the URLs in `backend/.env`. The init script runs only when the volume is new: after changing these values, reset the volume with `docker compose down -v`.

**Option B — a local PostgreSQL 16, without Docker**

1. Install PostgreSQL 16 (for example `winget install PostgreSQL.PostgreSQL.16` on Windows, the EDB installer, or your package manager).
2. Stop the Docker database if it runs (`docker compose down`), or install PostgreSQL on another port — both use 5432.
3. Create the user and the two databases (in `psql -U postgres`):
   ```sql
   CREATE ROLE squanchy LOGIN PASSWORD 'squanchy';
   CREATE DATABASE squanchy_bakery OWNER squanchy;
   CREATE DATABASE squanchy_bakery_test OWNER squanchy;
   ```
4. With these names the URLs in `backend/.env.example` work as they are. With your own server or names, change them in `backend/.env`:
   ```bash
   DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DB_NAME
   TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/TEST_DB_NAME
   ```

The database must be PostgreSQL; SQLite is not supported.

### 2. The backend

```bash
cd backend
cp .env.example .env                                       # then set JWT_SECRET and ADMIN_PASSWORD
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m scripts.seed                       # creates the tables and the admin user
.venv/Scripts/python -m flask --app app run                # API on http://127.0.0.1:5000
```

Login: `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `backend/.env`.

Settings and secrets are read from `backend/.env` (git-ignored; `backend/.env.example` lists them). Required: `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET` (at least 32 bytes), `ADMIN_USERNAME`, `ADMIN_PASSWORD`. Optional: `JWT_EXPIRES_MINUTES` (default 480), `LOG_LEVEL` (default `INFO`). Real environment variables override the file.

### 3. Run the tests

```bash
cd backend
.venv/Scripts/python -m pytest
```

The tests use `squanchy_bakery_test` and reset it for every test.

### 4. Try it with the sample file

`data/sample_week.xlsx` holds the 16 sample rows from the assignment. On an empty database, the first upload saves nothing and lists the 4 branches and 4 loggers as unknown; confirming them (the `register` field, which the UI sends after "add it?") saves the rows.

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

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

On PowerShell use `curl.exe` instead of `curl`.

### 5. The frontend

In progress; this section will explain how to run it.

## API overview

All routes are under `/api/v1`. Every route except `GET /health` and `POST /auth/login` needs `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/login` | Get a token |
| POST | `/readings/upload` | Upload an `.xlsx` file (optional `register` field) |
| POST | `/readings` | Add one reading (optional `register` key) |
| GET | `/readings` | Query readings: branch, city, fridge, logger, date range, temperature range in any unit, paging |
| PATCH / DELETE | `/readings/<id>` | Correct a reading / delete it (archived) |
| GET | `/alerts` | Query alerts (level, location, dates); `?archived=true` for alerts of deleted readings |
| GET | `/branches` | Branches with their fridges and loggers |
| PATCH / DELETE | `/branches/<id>` | Edit name, city, address / delete (history archived) |
| PATCH / DELETE | `/fridges/<id>` | Edit name, unit, logger, threshold profile / delete (history archived) |
| GET | `/branches/<id>/delete-impact`, `/fridges/<id>/delete-impact` | Counts for the delete confirmation |
| GET / POST | `/threshold-settings` | List profiles (with how many fridges use each) / create one |
| PUT / DELETE | `/threshold-settings/<id>` | Edit a profile / delete an unused one |
