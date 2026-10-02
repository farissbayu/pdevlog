# Part 5 — Documentation

**Goal:** Keep README and deployment docs in sync with the notes rename, the new
workspace type, and source material.

## Steps

1. **README.md**
   - Features: rename "Learning notes" → "Notes"; note they can be standalone or
     in any workspace type; add a bullet for **source material** (links that open
     in a new tab).
   - Workspaces feature: mention the three types (`work`, `learning`, `general`).
   - API Overview table: `/api/notes` (list/create), `/api/notes/:id`
     (read/update/delete). Remove `/learning-notes` rows.
   - Project structure tree: `features/` now includes `notes`; update the
     `learning-notes` mention.
   - Note the `note_sources` table if the docs describe the data model.

2. **docs/DEPLOYMENT.md**
   - No new secrets/bindings needed.
   - Add a short note that the notes rename migration runs with
     `bun run db:migrate:remote` and is data-preserving (renames tables and
     rewrites stored enum values), so run it before deploying the new Worker.

3. **tasks/backlog.md** (optional)
   - Move any now-completed items or add follow-ups (e.g. source auto-detection
     from a promoted spark).

## Verification

- Read through README API table and structure for stale `learning-notes` text.
- `grep -rn "learning-notes" README.md docs/` → only intentional history.

## Acceptance criteria

- [ ] README reflects Notes, workspace types, and sources.
- [ ] Deployment doc mentions the data-preserving rename migration.
- [ ] No stale `learning-notes` references in top-level docs.
