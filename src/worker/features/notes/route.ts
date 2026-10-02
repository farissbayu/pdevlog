import { zValidator } from "@hono/zod-validator";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  UNASSIGNED_WORKSPACE,
  noteFilterSchema,
  normalizeTagIds,
  type NoteFilterInput,
} from "@/shared/schemas/filters";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/shared/schemas/pagination";
import {
  createNoteSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type NoteResponse,
  type NoteSourceResponse,
  type UpdateNoteInput,
} from "@/shared/schemas/notes";
import type { TagResponse } from "@/shared/schemas/tag";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";
import { createDb, type Database } from "@/worker/db";
import {
  notes,
  noteSources,
  noteTags,
  sparks,
  tags,
  workspaces,
  type AttachmentRow,
  type NoteRow,
  type NoteSourceRow,
  type TagRow,
  type WorkspaceRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import {
  deleteOwnedAttachments,
  loadAttachments,
  loadAttachmentsByOwnerIds,
  moveAttachments,
  toAttachmentResponse,
} from "@/worker/features/attachments/helpers";

type JsonInput<T> = { in: { json: T }; out: { json: T } };
type QueryInput<T> = { in: { query: T }; out: { query: T } };

function toWorkspaceResponse(workspace: WorkspaceRow): WorkspaceResponse {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    type: workspace.type,
    createdAt: new Date(workspace.createdAt).toISOString(),
    updatedAt: new Date(workspace.updatedAt).toISOString(),
  };
}

function toTagResponse(tag: TagRow): TagResponse {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: new Date(tag.createdAt).toISOString(),
  };
}

function toNoteSourceResponse(source: NoteSourceRow): NoteSourceResponse {
  return {
    id: source.id,
    url: source.url,
    label: source.label,
  };
}

function toNoteResponse(
  note: NoteRow,
  workspace: WorkspaceRow | null,
  noteTagsList: TagRow[],
  sourceRows: NoteSourceRow[] = [],
  attachmentRows: AttachmentRow[] = [],
): NoteResponse {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    workspaceId: note.workspaceId,
    workspace: workspace ? toWorkspaceResponse(workspace) : null,
    tags: noteTagsList.map(toTagResponse),
    sources: sourceRows.map(toNoteSourceResponse),
    attachments: attachmentRows.map(toAttachmentResponse),
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
  };
}

async function findOwnedNote(
  db: Database,
  id: string,
  userId: string,
): Promise<NoteRow | undefined> {
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);
  return note;
}

async function loadTagsForNote(
  db: Database,
  noteId: string,
  userId: string,
): Promise<TagRow[]> {
  const rows = await db
    .select({ tag: tags })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(
      and(eq(noteTags.noteId, noteId), eq(tags.userId, userId)),
    );
  return rows.map((row) => row.tag);
}

async function loadTagsByNoteIds(
  db: Database,
  noteIds: string[],
  userId: string,
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (noteIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({ noteId: noteTags.noteId, tag: tags })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(
      and(inArray(noteTags.noteId, noteIds), eq(tags.userId, userId)),
    );

  for (const row of rows) {
    const list = map.get(row.noteId) ?? [];
    list.push(row.tag);
    map.set(row.noteId, list);
  }
  return map;
}

async function loadSourcesForNote(
  db: Database,
  noteId: string,
  userId: string,
): Promise<NoteSourceRow[]> {
  return db
    .select()
    .from(noteSources)
    .where(
      and(eq(noteSources.noteId, noteId), eq(noteSources.userId, userId)),
    )
    .orderBy(asc(noteSources.position), asc(noteSources.createdAt));
}

async function loadSourcesByNoteIds(
  db: Database,
  noteIds: string[],
  userId: string,
): Promise<Map<string, NoteSourceRow[]>> {
  const map = new Map<string, NoteSourceRow[]>();
  if (noteIds.length === 0) {
    return map;
  }

  const rows = await db
    .select()
    .from(noteSources)
    .where(
      and(
        inArray(noteSources.noteId, noteIds),
        eq(noteSources.userId, userId),
      ),
    )
    .orderBy(asc(noteSources.position), asc(noteSources.createdAt));

  for (const row of rows) {
    const list = map.get(row.noteId) ?? [];
    list.push(row);
    map.set(row.noteId, list);
  }
  return map;
}

async function loadWorkspace(
  db: Database,
  workspaceId: string | null,
  userId: string,
): Promise<WorkspaceRow | null> {
  if (!workspaceId) {
    return null;
  }
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1);
  return workspace ?? null;
}

async function validateWorkspaceOwnership(
  db: Database,
  workspaceId: string | null | undefined,
  userId: string,
): Promise<boolean> {
  if (workspaceId === null || workspaceId === undefined) {
    return true;
  }
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1);
  return Boolean(workspace);
}

async function validateTagOwnership(
  db: Database,
  tagIds: string[],
  userId: string,
): Promise<boolean> {
  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length === 0) {
    return true;
  }
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.id, uniqueIds)));
  return rows.length === uniqueIds.length;
}

function touchWorkspaceStatement(
  db: Database,
  workspaceId: string,
  userId: string,
  now: Date,
) {
  return db
    .update(workspaces)
    .set({ updatedAt: now })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));
}

const listNotes = async (
  c: Context<AppEnv, "/", QueryInput<NoteFilterInput>>,
) => {
  const userId = c.get("userId");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(notes.userId, userId)];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(
      like(notes.title, pattern),
      like(notes.content, pattern),
    );
    if (search) {
      conditions.push(search);
    }
  }

  if (filters.workspace_id === UNASSIGNED_WORKSPACE) {
    conditions.push(isNull(notes.workspaceId));
  } else if (filters.workspace_id) {
    conditions.push(eq(notes.workspaceId, filters.workspace_id));
  }

  if (filters.from) {
    conditions.push(gte(notes.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
  }

  if (filters.to) {
    conditions.push(lte(notes.createdAt, new Date(`${filters.to}T23:59:59.999Z`)));
  }

  const tagIds = normalizeTagIds(filters.tag_id);
  if (tagIds.length > 0) {
    conditions.push(
      inArray(
        notes.id,
        db
          .select({ id: noteTags.noteId })
          .from(noteTags)
          .where(inArray(noteTags.tagId, tagIds)),
      ),
    );
  }

  const where = and(...conditions);
  const { page, pageSize } = parsePagination(filters);

  const query = db
    .select({ note: notes, workspace: workspaces })
    .from(notes)
    .leftJoin(
      workspaces,
      and(
        eq(notes.workspaceId, workspaces.id),
        eq(workspaces.userId, userId),
      ),
    )
    .where(where)
    .orderBy(
      desc(notes.updatedAt),
      desc(notes.createdAt),
      desc(notes.id),
    );

  const [rows, totalRows] = await Promise.all([
    page === null ? query : query.limit(pageSize).offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(notes)
      .where(where),
  ]);
  const total = totalRows[0]?.value ?? 0;

  const tagsByNoteId = await loadTagsByNoteIds(
    db,
    rows.map((row) => row.note.id),
    userId,
  );
  const sourcesByNoteId = await loadSourcesByNoteIds(
    db,
    rows.map((row) => row.note.id),
    userId,
  );
  const attachmentsByNoteId = await loadAttachmentsByOwnerIds(
    db,
    "note",
    rows.map((row) => row.note.id),
    userId,
  );

  return c.json({
    notes: rows.map((row) =>
      toNoteResponse(
        row.note,
        row.workspace,
        tagsByNoteId.get(row.note.id) ?? [],
        sourcesByNoteId.get(row.note.id) ?? [],
        attachmentsByNoteId.get(row.note.id) ?? [],
      ),
    ),
    pagination: buildPaginationMeta(total, page, pageSize),
  });
};

const createNoteHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateNoteInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const workspaceId = input.workspace_id ?? null;
  const tagIds = [...new Set(input.tag_ids ?? [])];
  const sourceInputs = input.sources ?? [];

  if (!(await validateWorkspaceOwnership(db, workspaceId, userId))) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (!(await validateTagOwnership(db, tagIds, userId))) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const sparkId = input.spark_id;
  if (sparkId) {
    const [ownedSpark] = await db
      .select({ id: sparks.id })
      .from(sparks)
      .where(and(eq(sparks.id, sparkId), eq(sparks.userId, userId)))
      .limit(1);
    if (!ownedSpark) {
      return c.json({ error: "Spark not found" }, 404);
    }
  }

  const noteId = nanoid();
  const now = new Date();

  const insertNote = db.insert(notes).values({
    id: noteId,
    userId,
    workspaceId,
    title: input.title,
    content: input.content,
    createdAt: now,
    updatedAt: now,
  });
  const insertTags = tagIds.map((tagId) =>
    db.insert(noteTags).values({ noteId: noteId, tagId }),
  );
  const insertSources = sourceInputs.map((source, index) =>
    db.insert(noteSources).values({
      id: nanoid(),
      noteId,
      userId,
      url: source.url,
      label: source.label ?? null,
      position: index,
      createdAt: now,
    }),
  );

  const statements: BatchItem<"sqlite">[] = [
    insertNote,
    ...insertTags,
    ...insertSources,
  ];
  if (workspaceId) {
    statements.push(touchWorkspaceStatement(db, workspaceId, userId, now));
  }
  if (sparkId) {
    statements.push(
      db
        .update(sparks)
        .set({
          status: "promoted",
          promotedType: "note",
          promotedId: noteId,
          updatedAt: now,
        })
        .where(and(eq(sparks.id, sparkId), eq(sparks.userId, userId))),
    );
  }
  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  if (sparkId && input.carry_attachments !== false) {
    await moveAttachments(db, {
      fromOwnerType: "spark",
      fromOwnerId: sparkId,
      toOwnerType: "note",
      toOwnerId: noteId,
      userId,
    });
  }

  const [created] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .limit(1);

  const workspace = await loadWorkspace(db, created.workspaceId, userId);
  const createdTags = await loadTagsForNote(db, created.id, userId);
  const createdSources = await loadSourcesForNote(db, created.id, userId);
  const createdAttachments = await loadAttachments(
    db,
    "note",
    created.id,
    userId,
  );

  return c.json(
    {
      note: toNoteResponse(
        created,
        workspace,
        createdTags,
        createdSources,
        createdAttachments,
      ),
    },
    201,
  );
};

const getNote = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const note = await findOwnedNote(db, id, userId);
  if (!note) {
    return c.json({ error: "Note not found" }, 404);
  }

  const workspace = await loadWorkspace(db, note.workspaceId, userId);
  const noteTagsList = await loadTagsForNote(db, note.id, userId);
  const sourceRows = await loadSourcesForNote(db, note.id, userId);
  const attachmentRows = await loadAttachments(
    db,
    "note",
    note.id,
    userId,
  );

  return c.json({
    note: toNoteResponse(
      note,
      workspace,
      noteTagsList,
      sourceRows,
      attachmentRows,
    ),
  });
};

const updateNoteHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateNoteInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedNote(db, id, userId);
  if (!owned) {
    return c.json({ error: "Note not found" }, 404);
  }

  const hasTagIds = input.tag_ids !== undefined;
  const tagIds = [...new Set(input.tag_ids ?? [])];
  const hasSources = input.sources !== undefined;
  const sourceInputs = input.sources ?? [];

  if (
    input.workspace_id !== undefined &&
    !(await validateWorkspaceOwnership(db, input.workspace_id, userId))
  ) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (hasTagIds && !(await validateTagOwnership(db, tagIds, userId))) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const now = new Date();
  const updates: Partial<NoteRow> = { updatedAt: now };
  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.workspace_id !== undefined) {
    updates.workspaceId = input.workspace_id ?? null;
  }

  const updateNote = db
    .update(notes)
    .set(updates)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));

  const statements: BatchItem<"sqlite">[] = [updateNote];
  if (hasTagIds) {
    statements.push(
      db.delete(noteTags).where(eq(noteTags.noteId, id)),
    );
    statements.push(
      ...tagIds.map((tagId) =>
        db.insert(noteTags).values({ noteId: id, tagId }),
      ),
    );
  }
  if (hasSources) {
    statements.push(
      db.delete(noteSources).where(eq(noteSources.noteId, id)),
    );
    statements.push(
      ...sourceInputs.map((source, index) =>
        db.insert(noteSources).values({
          id: nanoid(),
          noteId: id,
          userId,
          url: source.url,
          label: source.label ?? null,
          position: index,
          createdAt: now,
        }),
      ),
    );
  }

  const targetWorkspaceId =
    input.workspace_id !== undefined ? input.workspace_id : owned.workspaceId;
  const touchedWorkspaces = new Set<string>();
  if (owned.workspaceId) touchedWorkspaces.add(owned.workspaceId);
  if (targetWorkspaceId) touchedWorkspaces.add(targetWorkspaceId);
  for (const workspaceId of touchedWorkspaces) {
    statements.push(touchWorkspaceStatement(db, workspaceId, userId, now));
  }

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  const [updated] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);

  const workspace = await loadWorkspace(db, updated.workspaceId, userId);
  const updatedTags = await loadTagsForNote(db, updated.id, userId);
  const updatedSources = await loadSourcesForNote(db, updated.id, userId);
  const updatedAttachments = await loadAttachments(
    db,
    "note",
    updated.id,
    userId,
  );

  return c.json({
    note: toNoteResponse(
      updated,
      workspace,
      updatedTags,
      updatedSources,
      updatedAttachments,
    ),
  });
};

const deleteNoteHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const owned = await findOwnedNote(db, id, userId);
  if (!owned) {
    return c.json({ error: "Note not found" }, 404);
  }

  const statements: BatchItem<"sqlite">[] = [
    db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId))),
  ];
  if (owned.workspaceId) {
    statements.push(
      touchWorkspaceStatement(db, owned.workspaceId, userId, new Date()),
    );
  }

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  await deleteOwnedAttachments(
    db,
    c.env.STORAGE,
    "note",
    id,
    userId,
  );

  return c.json({ success: true });
};

export const notesRoute = new Hono<AppEnv>()
  .get("/", zValidator("query", noteFilterSchema), listNotes)
  .post(
    "/",
    zValidator("json", createNoteSchema),
    createNoteHandler,
  )
  .get("/:id", getNote)
  .put(
    "/:id",
    zValidator("json", updateNoteSchema),
    updateNoteHandler,
  )
  .delete("/:id", deleteNoteHandler);
