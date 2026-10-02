# Part 4 — Tests (consolidated)

**Goal:** Prove the rename, the workspace generalization, and source material all
work, and keep the suite green.

## 4.1 — Rename fallout

- Rename `tests/isolation/learning-notes.test.ts` → `tests/isolation/notes.test.ts`.
- Update all `/api/learning-notes` paths to `/api/notes` and rename symbols/types.
- Update activity-type assertions from `"learning-note"` to `"note"` in
  `tests/dashboard.test.ts`.
- Files to touch:
  - `tests/dashboard.test.ts`
  - `tests/isolation/delete-account.test.ts`
  - `tests/isolation/pagination.test.ts`
  - `tests/isolation/search-filter.test.ts`
  - `tests/isolation/spark-attachments.test.ts`
  - `tests/isolation/sparks.test.ts`
  - `tests/isolation/workspace-delete-cascade.test.ts`

## 4.2 — New coverage

Add tests for:

1. **Workspace generalization**
   - Create a note in a `work` workspace → list by `workspace_id` returns it.
   - Create a note in a `general` workspace → works.
   - Standalone note → `workspace_id=none` filter returns it.

2. **Source material** (see Part 3.5)
   - Multi-source create/read/update-replace/delete-cascade.
   - Invalid URL → 400.
   - Cross-user isolation.

3. **Migration sanity**
   - After the rename migration, an attachment created for a note has
     `owner_type = 'note'`.
   - A spark promoted to a note stores `promoted_type = 'note'` (and `promoted_id`
     resolves to the note).

## Verification

- `bun run test` (all suites).
- Optionally `bun run test:watch` during development.

## Acceptance criteria

- [ ] No test references `learning-note` except historical migration files.
- [ ] New test cases pass.
- [ ] Full suite green (`bun run test`).
