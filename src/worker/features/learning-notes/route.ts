import { zValidator } from "@hono/zod-validator";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  noteFilterSchema,
  normalizeTagIds,
  type NoteFilterInput,
} from "@/shared/schemas/filters";
import {
  createLearningNoteSchema,
  updateLearningNoteSchema,
  type CreateLearningNoteInput,
  type LearningNoteResponse,
  type UpdateLearningNoteInput,
} from "@/shared/schemas/learning-note";
import type { TagResponse } from "@/shared/schemas/tag";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";
import { createDb, type Database } from "@/worker/db";
import {
  learningNotes,
  noteTags,
  tags,
  workspaces,
  type LearningNoteRow,
  type TagRow,
  type WorkspaceRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

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

function toLearningNoteResponse(
  note: LearningNoteRow,
  workspace: WorkspaceRow | null,
  noteTagsList: TagRow[],
): LearningNoteResponse {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    workspaceId: note.workspaceId,
    workspace: workspace ? toWorkspaceResponse(workspace) : null,
    tags: noteTagsList.map(toTagResponse),
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
  };
}

async function findOwnedNote(
  db: Database,
  id: string,
  userId: string,
): Promise<LearningNoteRow | undefined> {
  const [note] = await db
    .select()
    .from(learningNotes)
    .where(and(eq(learningNotes.id, id), eq(learningNotes.userId, userId)))
    .limit(1);
  return note;
}

async function loadTagsForNote(db: Database, noteId: string): Promise<TagRow[]> {
  const rows = await db
    .select({ tag: tags })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(eq(noteTags.learningNoteId, noteId));
  return rows.map((row) => row.tag);
}

async function loadTagsByNoteIds(
  db: Database,
  noteIds: string[],
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (noteIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({ learningNoteId: noteTags.learningNoteId, tag: tags })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(inArray(noteTags.learningNoteId, noteIds));

  for (const row of rows) {
    const list = map.get(row.learningNoteId) ?? [];
    list.push(row.tag);
    map.set(row.learningNoteId, list);
  }
  return map;
}

async function loadWorkspace(
  db: Database,
  workspaceId: string | null,
): Promise<WorkspaceRow | null> {
  if (!workspaceId) {
    return null;
  }
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
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

const listLearningNotes = async (
  c: Context<AppEnv, "/", QueryInput<NoteFilterInput>>,
) => {
  const userId = c.get("userId");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(learningNotes.userId, userId)];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(
      like(learningNotes.title, pattern),
      like(learningNotes.content, pattern),
    );
    if (search) {
      conditions.push(search);
    }
  }

  if (filters.workspace_id) {
    conditions.push(eq(learningNotes.workspaceId, filters.workspace_id));
  }

  if (filters.from) {
    conditions.push(gte(learningNotes.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
  }

  if (filters.to) {
    conditions.push(lte(learningNotes.createdAt, new Date(`${filters.to}T23:59:59.999Z`)));
  }

  const tagIds = normalizeTagIds(filters.tag_id);
  if (tagIds.length > 0) {
    conditions.push(
      inArray(
        learningNotes.id,
        db
          .select({ id: noteTags.learningNoteId })
          .from(noteTags)
          .where(inArray(noteTags.tagId, tagIds)),
      ),
    );
  }

  const rows = await db
    .select({ note: learningNotes, workspace: workspaces })
    .from(learningNotes)
    .leftJoin(workspaces, eq(learningNotes.workspaceId, workspaces.id))
    .where(and(...conditions))
    .orderBy(desc(learningNotes.updatedAt), desc(learningNotes.createdAt));

  const tagsByNoteId = await loadTagsByNoteIds(
    db,
    rows.map((row) => row.note.id),
  );

  return c.json({
    learningNotes: rows.map((row) =>
      toLearningNoteResponse(
        row.note,
        row.workspace,
        tagsByNoteId.get(row.note.id) ?? [],
      ),
    ),
  });
};

const createLearningNoteHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateLearningNoteInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const workspaceId = input.workspace_id ?? null;
  const tagIds = [...new Set(input.tag_ids ?? [])];

  if (!(await validateWorkspaceOwnership(db, workspaceId, userId))) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (!(await validateTagOwnership(db, tagIds, userId))) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const noteId = nanoid();
  const now = new Date();

  const insertNote = db.insert(learningNotes).values({
    id: noteId,
    userId,
    workspaceId,
    title: input.title,
    content: input.content,
    createdAt: now,
    updatedAt: now,
  });
  const insertTags = tagIds.map((tagId) =>
    db.insert(noteTags).values({ learningNoteId: noteId, tagId }),
  );

  const statements: BatchItem<"sqlite">[] = [insertNote, ...insertTags];
  if (workspaceId) {
    statements.push(touchWorkspaceStatement(db, workspaceId, userId, now));
  }
  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  const [created] = await db
    .select()
    .from(learningNotes)
    .where(eq(learningNotes.id, noteId))
    .limit(1);

  const workspace = await loadWorkspace(db, created.workspaceId);
  const createdTags = await loadTagsForNote(db, created.id);

  return c.json(
    { learningNote: toLearningNoteResponse(created, workspace, createdTags) },
    201,
  );
};

const getLearningNote = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const note = await findOwnedNote(db, id, userId);
  if (!note) {
    return c.json({ error: "Learning note not found" }, 404);
  }

  const workspace = await loadWorkspace(db, note.workspaceId);
  const noteTagsList = await loadTagsForNote(db, note.id);

  return c.json({
    learningNote: toLearningNoteResponse(note, workspace, noteTagsList),
  });
};

const updateLearningNoteHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateLearningNoteInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedNote(db, id, userId);
  if (!owned) {
    return c.json({ error: "Learning note not found" }, 404);
  }

  const hasTagIds = input.tag_ids !== undefined;
  const tagIds = [...new Set(input.tag_ids ?? [])];

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
  const updates: Partial<LearningNoteRow> = { updatedAt: now };
  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.workspace_id !== undefined) {
    updates.workspaceId = input.workspace_id ?? null;
  }

  const updateNote = db
    .update(learningNotes)
    .set(updates)
    .where(and(eq(learningNotes.id, id), eq(learningNotes.userId, userId)));

  const statements: BatchItem<"sqlite">[] = [updateNote];
  if (hasTagIds) {
    statements.push(
      db.delete(noteTags).where(eq(noteTags.learningNoteId, id)),
    );
    statements.push(
      ...tagIds.map((tagId) =>
        db.insert(noteTags).values({ learningNoteId: id, tagId }),
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
    .from(learningNotes)
    .where(eq(learningNotes.id, id))
    .limit(1);

  const workspace = await loadWorkspace(db, updated.workspaceId);
  const updatedTags = await loadTagsForNote(db, updated.id);

  return c.json({
    learningNote: toLearningNoteResponse(updated, workspace, updatedTags),
  });
};

const deleteLearningNoteHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const owned = await findOwnedNote(db, id, userId);
  if (!owned) {
    return c.json({ error: "Learning note not found" }, 404);
  }

  const statements: BatchItem<"sqlite">[] = [
    db
      .delete(learningNotes)
      .where(and(eq(learningNotes.id, id), eq(learningNotes.userId, userId))),
  ];
  if (owned.workspaceId) {
    statements.push(
      touchWorkspaceStatement(db, owned.workspaceId, userId, new Date()),
    );
  }

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  return c.json({ success: true });
};

export const learningNotesRoute = new Hono<AppEnv>()
  .get("/", zValidator("query", noteFilterSchema), listLearningNotes)
  .post(
    "/",
    zValidator("json", createLearningNoteSchema),
    createLearningNoteHandler,
  )
  .get("/:id", getLearningNote)
  .put(
    "/:id",
    zValidator("json", updateLearningNoteSchema),
    updateLearningNoteHandler,
  )
  .delete("/:id", deleteLearningNoteHandler);
