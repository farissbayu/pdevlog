# Part 6 — Verification & rollout

**Goal:** A single checklist to prove the whole feature set before merging/deploy.

## Quality gates

Run in order:

```bash
bun run db:generate        # inspect output — expect no unexpected/destructive diffs
bun run db:migrate:local
bun run typecheck
bun run lint
bun run test
bun run build
```

## Grep safety checks

```bash
# should return nothing in source/tests (drizzle/ migration history is allowed)
grep -rn "learning-note\|learningNote\|learning_note" src tests

# old routes should be gone
grep -rn "learning-notes" src
```

## Manual checklist

1. **Rename**
   - [ ] Sidebar shows **Notes**; `/notes` lists notes.
   - [ ] Opening/creating/editing a note under `/notes` works.
   - [ ] Dashboard recent activity shows a "Note" entry linking to `/notes/:id`.
   - [ ] Old `/learning-notes` path is gone (clean cut).

2. **Workspace generalization**
   - [ ] Create a note inside a `work` workspace; it shows there.
   - [ ] Create a note inside a `general` workspace; it shows there.
   - [ ] Create a standalone note; found via the "Unassigned" filter.
   - [ ] Workspace detail shows the Notes section for every type.

3. **Source material**
   - [ ] Add multiple `{ label, url }` sources in the editor; save.
   - [ ] Detail page lists them; clicking opens in a new tab.
   - [ ] Editing replaces the set (add/remove).
   - [ ] Invalid URL shows a validation error.
   - [ ] Deleting the note removes its sources.

4. **Cross-feature**
   - [ ] Promote a spark to a Note; the note appears under `/notes`.
   - [ ] Images carried on promotion still resolve via
         `/api/sparks/attachments/:id`.

## DB migration ordering (important)

Migrations must apply in this order:

1. Part 1 (`general` type) — no DDL expected.
2. Part 2a rename (`learning_notes` → `notes`, enum value rewrites).
3. Part 3 (`note_sources` table).

Verify local order via the drizzle journal; for remote, run
`bun run db:migrate:remote` before deploying the new Worker.

## Rollback notes

- The rename migration is not trivially reversible by hand; take a D1 export
  (`wrangler d1 export`) or snapshot before applying to production.
- `note_sources` is additive and safe to drop if rolled back.

## Acceptance criteria

- [ ] All quality gates pass.
- [ ] Grep checks clean.
- [ ] Manual checklist complete.
- [ ] Remote migration plan confirmed.
