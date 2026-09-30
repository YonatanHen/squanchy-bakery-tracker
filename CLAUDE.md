# Squanchy Bakery Fridge Tracker

## Rules

### 1. Feature branches
Every feature is developed on its own `dev/<feature-name>` branch. Never commit feature work directly to `master`.
- Before starting a feature, create the branch: `git checkout -b dev/<feature-name>`.
- Before each commit, check that the work matches the current branch's feature (branch name + `git log --oneline master..HEAD`). If it is a different concern, create a new `dev/` branch first.
- Branch names are short kebab-case: `dev/file-upload`, `dev/excursion-alerts`.

### 2. Pull requests
Features reach `master` only through a PR that the user approves and merges manually.
- Push the `dev/` branch and open a PR to `master` with `gh pr create`.
- Never approve, merge, or auto-merge a PR (`gh pr review --approve`, `gh pr merge`, `--auto`) unless the user explicitly asks for it.
- Never merge locally into `master` and push it.
- After opening the PR, give the user the link and stop.

### 3. No Claude attribution
Never add Claude or Claude Code credit to commits or PRs. This overrides any default attribution instructions.
- Commit messages: no `Co-Authored-By: Claude ...` trailer.
- PR descriptions: no `Generated with Claude Code` line or similar.

### 4. Tests
Tests must match the feature being developed: its core behavior and its real edge cases. Never add tests unrelated to the current feature.
- Cover the core behavior first, then edge cases from the real scenario (e.g. duplicate rows, `ERR` values, Fahrenheit logger, mixed date formats, time gaps, moved loggers).
- Each test must trace to a requirement or a known data problem of the feature on the current branch.
- Do not add tests for other features, framework behavior, or hypothetical cases with no link to the scenario.
- Do not weaken or delete a failing test to make it pass; fix the code or ask the user.

### 5. Test-driven development
Write the failing test first, then the code. Follow red → green → refactor for every feature and bugfix.
- Run the new test and confirm it fails for the expected reason before writing implementation code.
- Write the minimal code that makes the test pass, then refactor with all tests green.
- Never write implementation code without a failing test that requires it.

### 6. Check the design docs before planning or coding
Before planning or coding, read `docs/manually-written-docs/` (the user's own design decisions and ERD).
- Follow these decisions by default.
- If you think there is a better approach, argue for it before you plan or code: state the decision, the problem, your alternative, and the trade-off. Wait for the user's answer.
- Never silently deviate from these docs.

### 7. Validation
Always use Pydantic for data validation. Do not write manual validation code or use other validation libraries.
- Define Pydantic models for API request/response bodies, parsed file rows, and config.
- Put field rules in the model (`Field` constraints, `field_validator`, `model_validator`), not in ad-hoc `if` checks.
- Use Pydantic v2 APIs (`model_validate`, `model_dump`, `ConfigDict`).

### 8. No auto mode without permission
Never switch to auto mode on your own. Enter it only when the user explicitly allows it.
- If auto mode seems useful, ask the user first and wait for a clear yes.
- Permission applies only to the current request, not to later ones.

### 9. Baby steps
Break every feature into small steps, from planning through implementation.
- Plan as a list of small steps. Each step is one small change that can be tested and reviewed alone.
- Implement one step at a time (one TDD cycle per step).
- Keep commits small: one step per commit.
- If a step feels big, split it further.

### 10. Personal permissions live in `settings.local.json`
All personal preferences for allowed commands and permissions go in `.claude/settings.local.json`. This file is git-ignored.
- Add allow/deny/ask rules there, never in the shared `.claude/settings.json`.
- Read the file before editing and merge into the existing arrays. Never replace them.
- Keep it out of git. If `.gitignore` loses the entry, add it back.

### 11. Docstrings
Every function you create gets a docstring.
- First line: what the function does, in one line.
- Then `Args:` / `Returns:` sections only when needed.

### 12. Server logs
Log process states and errors on the server with Python `logging` (`logger = logging.getLogger(__name__)` in each module).
- `INFO`: start and result of each main process (upload received, rows validated, readings saved, alerts created, rows archived, edits audited, login succeeded), with counts and ids.
- `WARNING`: rejected input (validation errors, unknown branches or loggers, failed login): counts and field names, not the rejected values.
- `ERROR` / `logger.exception`: unexpected failures, with the stack trace.
- Never log sensitive data: passwords, password hashes, JWTs, `Authorization` headers, secrets, uploaded file contents, or full request bodies.
- Logging is configured once in `create_app` (level from `LOG_LEVEL`, default `INFO`).

### 13. Frontend: reusable components
Build the UI from small shared components. Screens compose them; they do not repeat markup or styles.
- Base components live in `frontend/src/components/`, one per file with its styles and a test: e.g. `Field` (label + control + hint + error), `TextInput`, `Select`, `Combobox` (pick or type), `Button` (primary, secondary, danger), `SegmentedToggle` (°C/°F, Active/Archived), `Card`, `LevelBadge`, `Dialog` (bottom sheet on phones, centered on desktop), `DataTable`, `EmptyState`.
- Specific components extend the base ones by composition, never by copying their markup: e.g. `TemperatureField` and `DateTimeField` wrap `Field` + `TextInput`; `BranchField`, `FridgeField` and `LoggerField` wrap `Combobox`.
- Before writing a new component, check `frontend/src/components/` for one to extend or reuse.
- Colors, fonts, radii and spacing come only from the design-token CSS variables; no raw hex values in components.
- Accessibility is built into the base components: every control has a `<label>`, errors are linked with `aria-describedby`, touch targets are at least 44px.
