# Implementation Plan — Phase 2: the weekly loop

**Status:** Done (2026-11-16)
**Why:** Phase 1 made the product coherent but still had no repeated action. Nothing in the app gave a reason to come back, so every subsystem was "fill this in and maybe it helps someday".

## The loop

One ritual, weekly: **open [Week recap](/week) → copy the bullets → set one target.**

| Step | Surface | Reuse |
|---|---|---|
| See the week | `/week` lists brag logs with `occurred_at` inside the week + a Mon–Sun strip from `GET /api/dashboard/check-ins` | existing `GET /api/brag-logs?from&to` (filters on `occurred_at` already) |
| Copy bullets | one line per entry, `Copy` to clipboard or `Download .md` | `bulletLine` from `src/shared/format/bullets.ts` (moved out of the worker so the client can use it too) |
| Set a target | one sentence → saved as a Spark | `POST /api/sparks` |

**No new endpoint, no migration, no cron, no email.** `/week?w=YYYY-MM-DD` is
bookmarkable and the dashboard links to it; that is the v1 trigger.

## Surface changes

- Sidebar: **Dashboard, Week, Achievements** primary, everything else under **More**.
- Mobile bottom nav: Dashboard, Week, Spark capture, Wins, More.
- Dashboard: one **This week** card (count + outcome totals + "Open week recap") + recent activity + zero-state capture. Removed: 4 stat cards, activity heatmap card, competency snapshot (both now live where they belong — `/week` and `/profile`).
- `check-in-card.tsx` deleted; the month heatmap was a consistency metric, not part of the loop.

## Deliberately not built

- **Email/cron reminder.** Needs Resend or Email Routing plus a cron trigger. Build it only after `/week` shows repeat visits; a weekly email to someone who never opens the recap just trains them to ignore it.
- **"Reviewed" state / streak of recaps.** Same trap as streaks: it turns a payoff into a chore.
- **Per-week notes or a saved recap record.** The bullets are reproducible from the entries; storing them duplicates the source of truth.

## Verification

- `tests/unit/week-range.test.ts` — Monday-start week math, Sunday mapping, month boundary, shift.
- Full suite: 26 files / 184 tests green; `tsc -b` and `vite build` clean.
- Manual: `/week` with 0 entries, with entries, `?w=` navigation, copy + download, target → Sparks inbox.
