import { zValidator } from "@hono/zod-validator";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  like,
  or,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import { UNASSIGNED_WORKSPACE } from "@/shared/schemas/filters";
import {
  createBragLogSchema,
  starBreakdownInputSchema,
  updateBragLogSchema,
  type BragLogResponse,
  type CreateBragLogInput,
  type StarBreakdownInput,
  type UpdateBragLogInput,
} from "@/shared/schemas/brag-log";
import {
  logFilterSchema,
  normalizeTagIds,
  type LogFilterInput,
} from "@/shared/schemas/filters";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/shared/schemas/pagination";
import type { TagResponse } from "@/shared/schemas/tag";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";
import { createDb, type Database } from "@/worker/db";
import {
  bragLogs,
  bragTags,
  sparks,
  tags,
  workspaces,
  type AttachmentRow,
  type BragLogRow,
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
import {
  generateStarBreakdown,
  StarBreakdownError,
} from "@/worker/lib/openrouter";
import { rateLimit } from "@/worker/middleware/rate-limit";

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

function toBragLogResponse(
  log: BragLogRow,
  workspace: WorkspaceRow | null,
  tags: TagRow[],
  attachmentRows: AttachmentRow[] = [],
): BragLogResponse {
  return {
    id: log.id,
    title: log.title,
    situation: log.situation,
    task: log.task,
    action: log.action,
    result: log.result,
    occurredAt: log.occurredAt,
    workspaceId: log.workspaceId,
    workspace: workspace ? toWorkspaceResponse(workspace) : null,
    tags: tags.map(toTagResponse),
    attachments: attachmentRows.map(toAttachmentResponse),
    createdAt: new Date(log.createdAt).toISOString(),
    updatedAt: new Date(log.updatedAt).toISOString(),
  };
}

async function findOwnedLog(
  db: Database,
  id: string,
  userId: string,
): Promise<BragLogRow | undefined> {
  const [log] = await db
    .select()
    .from(bragLogs)
    .where(and(eq(bragLogs.id, id), eq(bragLogs.userId, userId)))
    .limit(1);
  return log;
}

async function loadTagsForLog(
  db: Database,
  logId: string,
  userId: string,
): Promise<TagRow[]> {
  const rows = await db
    .select({ tag: tags })
    .from(bragTags)
    .innerJoin(tags, eq(bragTags.tagId, tags.id))
    .where(and(eq(bragTags.bragLogId, logId), eq(tags.userId, userId)));
  return rows.map((row) => row.tag);
}

async function loadTagsByLogIds(
  db: Database,
  logIds: string[],
  userId: string,
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (logIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({ bragLogId: bragTags.bragLogId, tag: tags })
    .from(bragTags)
    .innerJoin(tags, eq(bragTags.tagId, tags.id))
    .where(and(inArray(bragTags.bragLogId, logIds), eq(tags.userId, userId)));

  for (const row of rows) {
    const list = map.get(row.bragLogId) ?? [];
    list.push(row.tag);
    map.set(row.bragLogId, list);
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

const listBragLogs = async (
  c: Context<AppEnv, "/", QueryInput<LogFilterInput>>,
) => {
  const userId = c.get("userId");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(bragLogs.userId, userId)];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(
      like(bragLogs.title, pattern),
      like(bragLogs.situation, pattern),
      like(bragLogs.task, pattern),
      like(bragLogs.action, pattern),
      like(bragLogs.result, pattern),
    );
    if (search) {
      conditions.push(search);
    }
  }

  if (filters.workspace_id === UNASSIGNED_WORKSPACE) {
    conditions.push(isNull(bragLogs.workspaceId));
  } else if (filters.workspace_id) {
    conditions.push(eq(bragLogs.workspaceId, filters.workspace_id));
  }

  if (filters.from) {
    conditions.push(gte(bragLogs.occurredAt, filters.from));
  }

  if (filters.to) {
    conditions.push(lte(bragLogs.occurredAt, filters.to));
  }

  const tagIds = normalizeTagIds(filters.tag_id);
  if (tagIds.length > 0) {
    conditions.push(
      inArray(
        bragLogs.id,
        db
          .select({ id: bragTags.bragLogId })
          .from(bragTags)
          .where(inArray(bragTags.tagId, tagIds)),
      ),
    );
  }

  const where = and(...conditions);
  const { page, pageSize } = parsePagination(filters);

  const query = db
    .select({ log: bragLogs, workspace: workspaces })
    .from(bragLogs)
    .leftJoin(
      workspaces,
      and(
        eq(bragLogs.workspaceId, workspaces.id),
        eq(workspaces.userId, userId),
      ),
    )
    .where(where)
    .orderBy(
      desc(bragLogs.occurredAt),
      desc(bragLogs.createdAt),
      desc(bragLogs.id),
    );

  const [rows, totalRows] = await Promise.all([
    page === null ? query : query.limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(bragLogs).where(where),
  ]);
  const total = totalRows[0]?.value ?? 0;

  const tagsByLogId = await loadTagsByLogIds(
    db,
    rows.map((row) => row.log.id),
    userId,
  );
  const attachmentsByLogId = await loadAttachmentsByOwnerIds(
    db,
    "brag-log",
    rows.map((row) => row.log.id),
    userId,
  );

  return c.json({
    bragLogs: rows.map((row) =>
      toBragLogResponse(
        row.log,
        row.workspace,
        tagsByLogId.get(row.log.id) ?? [],
        attachmentsByLogId.get(row.log.id) ?? [],
      ),
    ),
    pagination: buildPaginationMeta(total, page, pageSize),
  });
};

const createBragLogHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateBragLogInput>>,
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

  const logId = nanoid();
  const now = new Date();

  const insertLog = db.insert(bragLogs).values({
    id: logId,
    userId,
    workspaceId,
    title: input.title,
    situation: input.situation,
    task: input.task,
    action: input.action,
    result: input.result,
    occurredAt: input.occurred_at,
    createdAt: now,
    updatedAt: now,
  });
  const insertTags = tagIds.map((tagId) =>
    db.insert(bragTags).values({ bragLogId: logId, tagId }),
  );

  const statements: BatchItem<"sqlite">[] = [insertLog, ...insertTags];
  if (workspaceId) {
    statements.push(touchWorkspaceStatement(db, workspaceId, userId, now));
  }
  if (sparkId) {
    statements.push(
      db
        .update(sparks)
        .set({
          status: "promoted",
          promotedType: "brag-log",
          promotedId: logId,
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
      toOwnerType: "brag-log",
      toOwnerId: logId,
      userId,
    });
  }

  const [created] = await db
    .select()
    .from(bragLogs)
    .where(and(eq(bragLogs.id, logId), eq(bragLogs.userId, userId)))
    .limit(1);

  const workspace = await loadWorkspace(db, created.workspaceId, userId);
  const createdTags = await loadTagsForLog(db, created.id, userId);
  const createdAttachments = await loadAttachments(
    db,
    "brag-log",
    created.id,
    userId,
  );

  return c.json(
    {
      bragLog: toBragLogResponse(
        created,
        workspace,
        createdTags,
        createdAttachments,
      ),
    },
    201,
  );
};

const getBragLog = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const log = await findOwnedLog(db, id, userId);
  if (!log) {
    return c.json({ error: "Brag log not found" }, 404);
  }

  const workspace = await loadWorkspace(db, log.workspaceId, userId);
  const logTags = await loadTagsForLog(db, log.id, userId);
  const attachmentRows = await loadAttachments(db, "brag-log", log.id, userId);

  return c.json({
    bragLog: toBragLogResponse(log, workspace, logTags, attachmentRows),
  });
};

const updateBragLogHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateBragLogInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedLog(db, id, userId);
  if (!owned) {
    return c.json({ error: "Brag log not found" }, 404);
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
  const updates: Partial<BragLogRow> = { updatedAt: now };
  if (input.title !== undefined) updates.title = input.title;
  if (input.situation !== undefined) updates.situation = input.situation;
  if (input.task !== undefined) updates.task = input.task;
  if (input.action !== undefined) updates.action = input.action;
  if (input.result !== undefined) updates.result = input.result;
  if (input.occurred_at !== undefined) updates.occurredAt = input.occurred_at;
  if (input.workspace_id !== undefined) {
    updates.workspaceId = input.workspace_id ?? null;
  }

  const updateLog = db
    .update(bragLogs)
    .set(updates)
    .where(and(eq(bragLogs.id, id), eq(bragLogs.userId, userId)));

  const statements: BatchItem<"sqlite">[] = [updateLog];
  if (hasTagIds) {
    statements.push(db.delete(bragTags).where(eq(bragTags.bragLogId, id)));
    statements.push(
      ...tagIds.map((tagId) =>
        db.insert(bragTags).values({ bragLogId: id, tagId }),
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
    .from(bragLogs)
    .where(and(eq(bragLogs.id, id), eq(bragLogs.userId, userId)))
    .limit(1);

  const workspace = await loadWorkspace(db, updated.workspaceId, userId);
  const updatedTags = await loadTagsForLog(db, updated.id, userId);
  const updatedAttachments = await loadAttachments(
    db,
    "brag-log",
    updated.id,
    userId,
  );

  return c.json({
    bragLog: toBragLogResponse(
      updated,
      workspace,
      updatedTags,
      updatedAttachments,
    ),
  });
};

const deleteBragLogHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const owned = await findOwnedLog(db, id, userId);
  if (!owned) {
    return c.json({ error: "Brag log not found" }, 404);
  }

  const statements: BatchItem<"sqlite">[] = [
    db
      .delete(bragLogs)
      .where(and(eq(bragLogs.id, id), eq(bragLogs.userId, userId))),
  ];
  if (owned.workspaceId) {
    statements.push(
      touchWorkspaceStatement(db, owned.workspaceId, userId, new Date()),
    );
  }

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  await deleteOwnedAttachments(db, c.env.STORAGE, "brag-log", id, userId);

  return c.json({ success: true });
};

const starBreakdownRateLimit = rateLimit({ limit: 10, windowMs: 60_000 });

const generateStarBreakdownHandler = async (
  c: Context<AppEnv, "/star-breakdown", JsonInput<StarBreakdownInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const tagOptions = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.userId, userId));

  try {
    const breakdown = await generateStarBreakdown(
      c.env,
      input.content,
      tagOptions,
    );
    return c.json({ breakdown });
  } catch (error) {
    if (error instanceof StarBreakdownError) {
      return c.json({ error: error.message }, 502);
    }
    throw error;
  }
};

export const bragLogsRoute = new Hono<AppEnv>()
  .get("/", zValidator("query", logFilterSchema), listBragLogs)
  .post("/", zValidator("json", createBragLogSchema), createBragLogHandler)
  .post(
    "/star-breakdown",
    starBreakdownRateLimit,
    zValidator("json", starBreakdownInputSchema),
    generateStarBreakdownHandler,
  )
  .get("/:id", getBragLog)
  .put("/:id", zValidator("json", updateBragLogSchema), updateBragLogHandler)
  .delete("/:id", deleteBragLogHandler);
