# Part 3 — Source material for notes

**Goal:** A note can carry a list of **source materials** (URL + optional label).
Clicking a source opens it directly in a new browser tab.

Decisions:
- Many sources per note.
- Shape: `{ url, label? }` (URL required, label optional).
- URL must be `http(s)://`.
- Separate table, ordered by creation (`position`).
- Sources shown on the **detail page**; list card may show a count (optional).

Depends on: Part 2a (notes rename).

## 3.1 — Schema + migration

Add to `src/worker/db/schema.ts`:

```ts
export const noteSources = sqliteTable(
  "note_sources",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("note_sources_note_id_idx").on(table.noteId)],
);

export type NoteSourceRow = typeof noteSources.$inferSelect;
export type NewNoteSourceRow = typeof noteSources.$inferInsert;
```

Run `bun run db:generate` to produce the `CREATE TABLE note_sources` migration.
Create this migration **after** the Part 2a rename migration.

## 3.2 — Shared schema

In `src/shared/schemas/notes.ts`:

```ts
const noteSourceInputSchema = z.object({
  url: z.string().trim().url().refine((v) => /^https?:\/\//.test(v), {
    message: "Source URL must start with http:// or https://",
  }).max(2048),
  label: z.string().trim().max(200).optional(),
});

// create/update:
sources: z.array(noteSourceInputSchema).max(20).optional(),

// response:
export const noteSourceResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  label: z.string().nullable(),
});

// add to noteResponseSchema:
sources: z.array(noteSourceResponseSchema),
```

Update inferred input/response types.

## 3.3 — Worker

`src/worker/features/notes/route.ts`:
- `toNoteSourceResponse(row)`.
- `loadSourcesForNote(db, noteId, userId)` and
  `loadSourcesByNoteIds(db, noteIds, userId)` (mirror the tag loaders).
- Include `sources` in list/detail/create/update responses.
- Create: after inserting the note, batch-insert each source with `position = index`.
- Update: if `sources` is provided, replace the whole set (delete existing, then
  insert), consistent with how `tag_ids` is handled.
- Delete: rely on FK cascade (`note_sources.note_id → notes.id ON DELETE CASCADE`).
- Add `sources` back-reference is not needed elsewhere.

## 3.4 — Client

1. **Note editor** — `src/client/features/notes/note-editor.tsx`
   - Add a "Sources" section: repeatable rows of `{ label (optional), url }`.
   - Add/remove controls; enforce `http(s)` client-side (mirror Zod).
   - Include `sources` in the payload for both create and update.
   - Pre-fill existing sources when editing.
   - (Optional) when arriving via `?spark=`, if the spark text starts with a URL,
     prefill one source row.

2. **Note detail** — `src/client/features/notes/note-detail-page.tsx`
   - Render a "Sources" block near the header: one link per source.
   - `<a href={url} target="_blank" rel="noreferrer noopener">` showing
     `label || url` plus an `ExternalLink` icon.
   - Hide the block entirely when there are no sources.

3. **Note list card** — `src/client/features/notes/note-list.tsx` (optional)
   - Show a small link icon + count when `note.sources.length > 0`.

## 3.5 — Tests

Add to `tests/isolation/notes.test.ts` (or a dedicated
`tests/isolation/note-sources.test.ts`):
- Create a note with 2 sources → returned in detail and list.
- Update replaces the set (add/remove/reorder).
- Invalid URL (`ftp://`, `not-a-url`) → 400.
- Sources are scoped to the owner (cross-user 404 via the note).
- Deleting the note cascades its sources (assert `note_sources` count = 0).
- Standalone note can still have sources.

## Verification

- `bun run db:generate`, `bun run db:migrate:local`.
- `bun run typecheck && bun run lint && bun run test && bun run build`.
- Manual: add sources, click → opens new tab; edit/remove; promote a spark to note.

## Acceptance criteria

- [ ] Notes support 0..N sources of `{ url, label? }`.
- [ ] Clicking a source opens it in a new tab.
- [ ] Invalid URLs rejected (client + server).
- [ ] Sources persist across list/detail/edit and cascade on note delete.
- [ ] All quality gates pass.
