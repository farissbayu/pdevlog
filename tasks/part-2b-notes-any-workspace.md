# Part 2b — Notes allowed in any workspace (decouple from "learning")

**Goal:** Notes are a generic, cross-cutting entity. They can be standalone **or**
attached to a workspace of **any** type (`work`, `learning`, `general`).

Depends on: Part 2a (rename) and Part 1 (`general` type).

## Steps

1. **Note editor workspace picker** — `src/client/features/notes/note-editor.tsx`
   - Remove the filter that restricts to learning workspaces:
     ```tsx
     // before
     .filter((w) => w.type === "learning" || w.id === workspaceId)
     // after
     .map(...) // list all workspaces
     ```
   - Keep the "No workspace" option.

2. **Workspace detail page** — `src/client/features/workspaces/workspace-detail-page.tsx`
   - Change the notes section gate from `workspace.type === "learning"` to render
     for **all** workspace types (i.e., always show the Notes section).
   - Rename the heading/copy from "Learning notes" to "Notes".

3. **Global notes page / list** — `src/client/features/notes/notes-page.tsx`,
   `note-list.tsx`
   - Update copy so it does not imply learning-only ("Notes" not "Learning Notes").

4. **Worker** — `src/worker/features/notes/route.ts`
   - No change needed: `validateWorkspaceOwnership` is type-agnostic; the list
     already supports `workspace_id=none` (Unassigned) from the earlier brag work.

## Verification

- `bun run typecheck && bun run lint && bun run test`.
- Manual:
  - Create a note in a `work` workspace → appears there.
  - Create a note in a `general` workspace → appears there.
  - Create a standalone note → appears in `/notes` (Unassigned filter works).
  - Edit a note to move it between workspaces of different types.

## Acceptance criteria

- [ ] Notes can attach to `work`, `learning`, and `general` workspaces.
- [ ] Notes can be standalone; "Unassigned" filter finds them.
- [ ] Workspace detail shows a Notes section regardless of type.
- [ ] No user-facing copy says "learning" for notes.
- [ ] All quality gates pass.
