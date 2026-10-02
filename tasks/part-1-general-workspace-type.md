# Part 1 — Add `general` workspace type

**Goal:** Allow workspaces to be semantically neutral, so notes/entries aren't
forced to be `work` or `learning`.

## Scope

- Add `"general"` to the workspace type enum (additive; no data loss).
- Show it in the create/edit workspace dialog and the type badge.

## Steps

1. **Schema enum** — `src/worker/db/schema.ts`
   - `export const workspaceTypes = ["work", "learning", "general"] as const;`

2. **Shared Zod enum** — `src/shared/schemas/workspace.ts`
   - `export const workspaceTypeSchema = z.enum(["work", "learning", "general"]);`

3. **Workspace form dialog** — `src/client/features/workspaces/workspace-form-dialog.tsx`
   - Add `{ value: "general", label: "General" }` to `typeOptions` (line ~26).
   - Change the option grid from `grid-cols-2` to `grid-cols-3` (line ~140).

4. **Type badge** — `src/client/features/workspaces/workspace-type-badge.tsx`
   - Add a `general` case: pick an icon (e.g. `Boxes` / `Layers`) and a neutral
     color (e.g. `slate` / `zinc`). Keep `work`/`learning` unchanged.

5. **Migration** — run `bun run db:generate`.
   - Expected: no destructive SQL (the column is `text`; widening a TS enum needs
     no DDL). If Drizzle emits nothing, that is fine — document it.

## Verification

- `bun run typecheck && bun run lint && bun run test`.
- Manual: create a workspace with type `General`; badge renders; edit shows it selected.

## Acceptance criteria

- [ ] `general` selectable when creating/editing a workspace.
- [ ] Badge renders a distinct style for `general`.
- [ ] Existing `work`/`learning` workspaces unaffected.
- [ ] All quality gates pass.
