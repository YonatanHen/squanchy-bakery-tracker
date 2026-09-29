---
name: logging-decisions
description: Use when a design or implementation decision is made, a doubt or open question appears, an assumption fills a gap in Summer's requirements, scope is cut or postponed, the user rejects or corrects an AI suggestion, or a work step or session starts or ends in the Squanchy Bakery fridge tracker project
---

# Logging Decisions

## Overview

`decisions.md` (project root, git-ignored) is the raw log behind the public `NOTES.md`.
The user will not remember everything, so every decision and doubt is logged when it happens.

**Core rule:** log in parallel. Never pause the main work to write the log.

## Entry Types

| Type | Log when | Feeds NOTES.md section |
|---|---|---|
| `DECISION` | A choice Summer did not ask for | Decisions Summer didn't ask for, and why |
| `DOUBT` | Unclear requirement, assumption, open question | What to ask Summer before going live |
| `NOT-DONE` | Feature cut, postponed, or left partial | What's not done / one more hour |
| `AI-REJECTED` | AI output was wrong, or the user rejected or corrected it | How you worked with AI tools |
| `TIME` | Session or work step starts or ends | Roughly how long you spent |
| `APPROACH` | A working method worth mentioning | Anything else (optional) |

## Main Agent: Dispatch

1. Spawn one background agent: `Agent` with `subagent_type: "fork"` and this prompt:
   `Run the Logger steps of the logging-decisions skill for everything since the last entry in decisions.md.`
2. Continue the main work immediately. Do not wait for the logger.
3. Run only one logger at a time. If one is still running, send the next one after it finishes.

If `fork` is not available, use `general-purpose` and write the full entries in the prompt. That agent has no conversation context.

## Logger: Steps

1. Read the end of `decisions.md` to find the last logged entry.
2. List every new item from the conversation that matches an entry type. Skip items already logged.
3. Get the time with `date '+%Y-%m-%d %H:%M'`.
4. Write all new entries to `decisions.new.md` in the scratchpad directory with the Write tool. Append them with `cat <scratchpad>/decisions.new.md >> decisions.md`. Never use Write on `decisions.md` itself, because Write replaces the whole file. Do not edit other project files.
5. Report one line: the number of entries added and their titles.

## Entry Format

```markdown
## 2026-09-29 16:40 | DECISION | Branch table instead of a city column
- What: Branches are stored in their own table with city and address.
- Why: A city can get a second branch, for example "Tel-Aviv Azrieli".
- Alternatives: Branch name as a text column on the fridge.
- Evidence: docs/manually-written-docs/initial design decisions.md, decision 2
```

- No `By` field. All decisions are the user's.
- `Evidence`: a file path, test name, or commit SHA. Write `none yet` if nothing exists.
- `AI-REJECTED` replaces `Why` and `Alternatives` with `AI proposed`, `Problem`, `How it was caught`.
- `DOUBT` replaces `Why` and `Alternatives` with `Question for Summer` and `Current assumption`.

## Rules

- Append only. Never rewrite, reorder, or delete old entries. A changed decision gets a new entry that names the old one.
- Log facts from the conversation and the repo only. Quote the user's words when the reason is theirs.
- Log doubts even when they were resolved a minute later. The resolution goes in the same entry.
- One entry per decision. Do not merge different decisions into one entry.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Logging at the end of the session from memory | Dispatch the logger when the decision happens |
| Writing the log in the main agent and blocking the work | Dispatch the background logger |
| Two loggers appending at the same time | One logger at a time |
| Logging only final decisions | Doubts and rejected AI suggestions are required by NOTES.md |
| Appending with a heredoc (`cat >> file <<'EOF'`) | It fails on apostrophes in this shell. Use the temp file from step 4 |
| `Evidence: none yet` never updated | Add a new entry with the commit SHA or test name when it exists |
