# Part 2a — Full rename: learning notes → notes

**Goal:** Rename the entity everywhere — code, routes, DB tables, UI — from
`learning-note`/`learning_notes` to `note`/`notes`. No behavior change; do this
as a mechanical pass and commit only when all gates are green.

> **Risk:** ~425 references across 32 files, plus a **data migration** for stored
> enum values (`attachments.owner_type`, `sparks.promoted_type`).

## 2a.1 — DB rename + data migration

Create one migration (via `bun run db:generate`, then hand-edit if needed).
SQLite supports `RENAME TO` / `RENAME COLUMN`.

```sql
-- tables
ALTER TABLE learning_notes RENAME TO notes;
ALTER TABLE note_tags RENAME TO note_tags;      -- name already fine
ALTER TABLE note_tags RENAME COLUMN learning_note_id TO note_id;

-- indexes (rename to match new conventions)
DROP INDEX IF EXISTS learning_notes_user_id_workspace_id_idx;
CREATE INDEX notes_user_id_workspace_id_idx ON notes (user_id, workspace_id);

-- stored enum values
UPDATE attachments SET owner_type = 'note' WHERE owner_type = 'learning-note';
UPDATE sparks      SET promoted_type = 'note' WHERE promoted_type = 'learning-note';
```

Then update `src/worker/db/schema.ts`:
- `learningNotes` → `notes` (table `"notes"`).
- `noteTags.learningNoteId` → `noteTags.noteId`.
- `attachmentOwnerTypes`: replace `"learning-note"` with `"note"`.
- `sparkPromotionTypes`: replace `"learning-note"` with `"note"`.
- Export types: `LearningNoteRow` → `NoteRow`, `NewLearningNoteRow` → `NewNoteRow`.

**Order matters:** run the rename migration before creating `note_sources`
(Part 3) so FKs point at the final table name.

## 2a.2 — Shared schemas

- Move `src/shared/schemas/learning-note.ts` → `src/shared/schemas/notes.ts`.
- Rename symbols: `createLearningNoteSchema`→`createNoteSchema`,
  `updateLearningNoteSchema`→`updateNoteSchema`, `learningNoteResponseSchema`→
  `noteResponseSchema`, list/detail schemas and all inferred types.
- `dashboard.ts`: `activityTypeSchema` `"learning-note"` → `"note"`.

## 2a.3 — Worker

- Move `src/worker/features/learning-notes/route.ts` → `src/worker/features/notes/route.ts`.
- Rename `learningNotesRoute` → `notesRoute`; mount at `/api/notes` in
  `src/worker/index.ts`.
- Update all helpers/loaders and response mappers
  (`toLearningNoteResponse` → `toNoteResponse`, etc.).
- `dashboard/route.ts`: activity type `"learning-note"` → `"note"`; table import.
- Promotion in `notes/route.ts` and `brag-logs/route.ts`: use `promotedType:"note"`
  and `ownerType:"note"` when moving attachments.

## 2a.4 — Client

- Move `src/client/features/learning-notes/` → `src/client/features/notes/`.
- Rename files: `learning-notes-page.tsx`→`notes-page.tsx`,
  `learning-note-list.tsx`→`note-list.tsx`,
  `learning-note-detail-page.tsx`→`note-detail-page.tsx`;
  `note-editor.tsx`, `note-toc.tsx`, `note-stats.ts` keep their names.
- Rename hooks: `useLearningNotesQuery`→`useNotesQuery`,
  `useLearningNoteDetailQuery`→`useNoteDetailQuery`, and mutations.
- `router.tsx`: replace `/learning-notes*` with:
  - `/notes`, `/notes/new`, `/notes/:id`, `/notes/:id/edit`
  - **Clean cut** (no redirects) per decision.
- API client paths: `client.api["learning-notes"]` → `client.api.notes`.
- `spark-list.tsx` / `sparks-page.tsx`: promoted href `/notes/:id`,
  `promotedType === "note"`.
- **UI labels**: sidebar `Learning Notes` → `Notes`; all headers, empty states,
  form copy, `note-editor` title/placeholder.
- Note detail back-link fallback `/learning-notes` → `/notes`.

## 2a.5 — Tests

- Rename `tests/isolation/learning-notes.test.ts` → `tests/isolation/notes.test.ts`.
- Update paths/symbols in: `dashboard.test.ts`, `delete-account.test.ts`,
  `pagination.test.ts`, `search-filter.test.ts`, `spark-attachments.test.ts`,
  `sparks.test.ts`, `workspace-delete-cascade.test.ts`.
- All `/api/learning-notes` → `/api/notes`; activity type assertions `"note"`.

## 2a.6 — Docs

- `README.md`: feature name, API table (`/api/notes`), project structure tree.

## Verification

- `bun run db:generate` (inspect), `bun run db:migrate:local`.
- `bun run typecheck && bun run lint && bun run test && bun run build`.
- Grep for stragglers:
  `grep -rn "learning-note\|learningNote\|learning_note" src tests` → should be empty
  (except intentional migration history under `drizzle/`).

## Acceptance criteria

- [ ] No `learning-note` references remain in `src/` or `tests/`.
- [ ] `/api/notes` and `/notes` work; old paths are gone (clean cut).
- [ ] Stored `owner_type`/`promoted_type` migrated to `note`.
- [ ] Dashboard activity shows "Note" and links to `/notes/:id`.
- [ ] All quality gates pass on a fresh `db:migrate:local`.
