# NOTES

## How long it took

- About 8 hours of net work, spread over 2026-09-29 and 2026-10-01.

## Decisions Summer didn't ask for, and why

1. **Branches, fridges and loggers are registered from the upload.** No onboarding form. An unknown branch or logger is never created silently: the upload asks "Did you mean ... / Add it?". Why: her first action is an upload, and the names are already in the file.
2. **Partial upload.** Valid rows are saved; invalid rows are listed with row, field and message. Re-uploading the fixed file is safe: saved rows are skipped as duplicates (unique logger + time).
3. **Messy input is normalized, not guessed.** Names match in any case and spacing, two date formats are accepted, columns are found by header name, and `ERR` is stored as a reading with no temperature. Excel and CSV go through one Strategy + Factory parser design, so a new format is one new class.
4. **Units are kept as measured.** The unit is a fridge setting (Haifa = °F). The rules convert to °C, and the UI shows °C or °F. Why: the logger is a third-party device, so the DB keeps its original value.
5. **Deterministic alert rules.** Limit (one alert per period outside the min/max limits, with start, end and duration: the inspector's "when, and for how long"), growth (slow
warming) and gap (checked in the data, not against the clock). Why: reproducible for the inspector and testable with TDD.
6. **One reading outside the limits is a non-urgent alert; two or more in a row are urgent.** Summer: "a jump for one reading, which is fine. A fridge that's slowly warming up is not fine." A door opening is still recorded, but it does not look like a failing fridge.
7. **Shared, named threshold settings** (min/max, growth, gap). One set can serve all dairy fridges. New fridges get "default" (0–5°C), and every value can be changed in the app.
8. **A delete never loses history.** Readings and alerts move to archive tables in the same transaction, with name snapshots. They can be viewed and restored. Why: accidental deletes, and inspector questions later.
9. **Mobile first, one responsive app.** "I mostly look at things on my phone." From 900px the same app uses a sidebar and tables. Mockups were approved before any frontend code.
10. **Code built to grow.** Layered backend (models / services / thin API), Pydantic for all validation, a logger table and an optional branch address for future loggers and branches, reusable React components, and the whole app runs with one `docker compose up`. The readings and alerts lists are paginated (10 per page, offset pagination in the API and the UI), so the app never loads all readings at once when the readings and the branches grow.

## What I would ask Summer before this goes live

**Scale and growth**
- How many fridges does each branch have? What are the other 8 branches?
- Can one fridge have more than one logger? Can a logger move to another fridge? _Now: one logger per fridge; the logger table allows both later._
- Can one city have more than one branch? How do you tell them apart? _Now: branch name + optional address._

**People and access**
- Should anyone else log in? For example branch managers who see only their branch, or read-only users? _Now: one admin user._
- Who handles the alerts while you are away? Should the app send them to someone else?
- Do you want reports or notifications on your phone (push, email, WhatsApp)?

**The loggers**
- How do the managers download the files from the loggers? Can we automate it (a Wi-Fi logger or a cloud export), so data arrives daily and urgent alerts go to an on-call service? _Now: weekly manual upload, so a slow failure can still go unseen for days._
- Does the Haifa logger record in Fahrenheit? Any others? _Now: Haifa °F, all others °C._
- Does every logger record every 15 minutes? Are the times Israel local time or UTC? _Daylight saving can create a false gap or a false duplicate._
- Do the loggers record door or battery state? That would explain gaps and spikes.
- The Tel Aviv logger TL-0417 moved "into the new display fridge". Is the Walk-in still in use with another logger, or was it replaced by the display fridge? _Now: the app treats it as a rename (Walk-in → Display 2), so the Walk-in's older readings show under Display 2. If it was a real move, each reading must keep the fridge it was recorded in (a logger–fridge history with dates)._

**Rules and records**
- Which limits does the inspector use? Are they different per product (dairy, cream cakes)? _Now: 0–5°C by default, editable per threshold settings._
- What should happen after an alert: who checks the fridge, when is product thrown out?
- How long must readings be kept for the Ministry of Health? In which format does the inspector want the answer?
- Do you want your past weeks' Excel sheets imported?
- Should the app be in Hebrew for the branch managers?

## What's not done, and what I would do with one more hour

- **Fridge status overview**: one card per fridge with last reading, last upload, open alerts and a green/amber/red state. This is the "one place" Summer asked for; today it is split between Readings and Alerts.
- **Temperature chart per fridge**, so slow warming is visible at a glance.
- **Raw logger file upload**: a file with only time and temperature, with the logger picked in the form. This removes the typing Summer does today.
- **Upload many files at once.**
- **Download the inspector's answer as a file (CSV or PDF):**  the periods above the limit for a fridge and date range, with start, end, duration and peak, ready to email or print.
- **Acknowledge / resolve alerts**, so only new ones show.
- **Stricter time validation for readings**: refuse a reading with a future time, and a second reading of the same fridge/logger at the same time with a different value. In a file upload the first row is kept and the conflict is reported; in the "Add a reading" form the user gets an error message. _Today: a second reading at the same logger and time is skipped as a duplicate, even when its value differs, and future times are accepted._

With more time:
- **React Native mobile app**, since Summer works mostly from her phone. The web app is mobile first for now, because it is easy to run on a laptop without more dependencies like Expo.
- **CI/CD workflow**: lint, type-check, backend and frontend tests and the Docker build on every PR, then deploy.

Also open: no migrations tool (a schema change needs a DB reset), daylight saving time, missing indexes on `alerts.reader_id` and `reader.time`, the old fridge is not re-checked after a reading moves, no Playwright E2E tests.

## How I worked with AI tools

I used Claude Code. My rules for it are in `CLAUDE.md`: read my design doc first, argue before changing a decision, TDD, small steps, one `dev/` branch and PR per feature (I merge). A project skill (`.claude/skills/logging-decisions/`) logged every decision, doubt and rejected suggestion to `decisions.md` (gitignored) while I worked.

**What it got wrong: Celsius / Fahrenheit**
- **What happened:** changing a fridge from °C to °F in the fridge settings changed only the fridge. Its saved readings kept °C, so the Haifa logger still showed 38.3 °C. The tests checked only the fridge row.
- **How I caught it:** I rebuilt the Docker Compose app and tested the flow in the UI.
- **Fix:** a unit change relabels the fridge's readings (values stay the same, because 38.3 was always °F) and re-runs the alerts. Later the unit comes only from the fridge settings, never from a reading.
- **Where:** [PR #31](https://github.com/YonatanHen/squanchy-bakery-tracker/pull/31), `test_changing_a_fridge_unit_relabels_its_readings`; [PR #35](https://github.com/YonatanHen/squanchy-bakery-tracker/pull/35), `test_patch_cannot_change_a_reading_unit`.

## Approach

- I wrote the design and the ERD by hand first (`docs/manually-written-docs/`: plain text + draw.io).
- Then I used plan mode to review it with Claude. Its questions helped me find the gaps and choose the path.
- Claude wrote the spec and the plan (`docs/superpowers/`). I implemented in manual mode and checked that Claude did what I expected at each step.
- I validated features with the tests and by rebuilding the Docker Compose app and using the UI.
- The history is not cleaned up: every feature has its own branch and PR.
