# Notes generalization + source material — task index

Umbrella plan: generalizing **learning notes → notes**, decoupling notes from the
`learning` workspace type, adding a `general` workspace type, and adding
**source material** links to notes.

Execute in order. Each part is self-contained with its own acceptance criteria.

| Part | File | Depends on |
|---|---|---|
| 1 | [part-1-general-workspace-type.md](./part-1-general-workspace-type.md) | — |
| 2a | [part-2a-rename-notes.md](./part-2a-rename-notes.md) | Part 1 |
| 2b | [part-2b-notes-any-workspace.md](./part-2b-notes-any-workspace.md) | Part 2a |
| 3 | [part-3-note-sources.md](./part-3-note-sources.md) | Part 2a |
| 4 | [part-4-tests.md](./part-4-tests.md) | Parts 2a, 2b, 3 |
| 5 | [part-5-docs.md](./part-5-docs.md) | Parts 2a, 2b, 3 |
| 6 | [part-6-verification.md](./part-6-verification.md) | all |

## Locked decisions

- Source material = **URL + optional label**, many per note, opens in a new tab.
- Sources stored in a **separate `note_sources` table**.
- Notes allowed in **any** workspace type **and** standalone.
- Add a **`general`** workspace type.
- **Full rename** (code, routes, DB tables, UI); **clean cut** to `/notes`
  (no redirects from `/learning-notes`).

## Migration ordering

1. `general` type (no DDL)
2. rename (`learning_notes` → `notes`, rewrite `owner_type`/`promoted_type`)
3. `note_sources` table

## Open questions still to confirm

1. URL scheme allowed: `http(s)` only (assumed) or also `mailto:` etc.?
2. Sources on list cards: detail-only (assumed) or show a count on cards?
3. Promotion pre-fill: auto-create a source from a spark URL (assumed **no**)?
4. Workspace type label: **"General"** (assumed) or "Personal"/"Other"?
5. Source ordering UI: creation order only (assumed), no drag-and-drop.
