import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  workspaceFilterSchema,
  type WorkspaceFilterInput,
} from "@/shared/schemas/filters";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/shared/schemas/pagination";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type WorkspaceResponse,
} from "@/shared/schemas/workspace";
import { createDb } from "@/worker/db";
import { workspaces, type WorkspaceRow } from "@/worker/db/schema";
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

function findOwnedWorkspace(
  db: ReturnType<typeof createDb>,
  id: string,
  userId: string,
) {
  return db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .limit(1);
}

const listWorkspaces = async (
  c: Context<AppEnv, "/", QueryInput<WorkspaceFilterInput>>,
) => {
  const userId = c.get("userId");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(workspaces.userId, userId)];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(
      like(workspaces.name, pattern),
      like(workspaces.description, pattern),
    );
    if (search) {
      conditions.push(search);
    }
  }

  const where = and(...conditions);
  const { page, pageSize } = parsePagination(filters);

  const [totalRow] = await db
    .select({ value: count() })
    .from(workspaces)
    .where(where);
  const total = totalRow?.value ?? 0;

  const query = db
    .select()
    .from(workspaces)
    .where(where)
    .orderBy(desc(workspaces.createdAt), desc(workspaces.id));

  const rows =
    page === null
      ? await query
      : await query.limit(pageSize).offset((page - 1) * pageSize);

  return c.json({
    workspaces: rows.map(toWorkspaceResponse),
    pagination: buildPaginationMeta(total, page, pageSize),
  });
};

const createWorkspaceHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateWorkspaceInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const [created] = await db
    .insert(workspaces)
    .values({
      id: nanoid(),
      userId,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ workspace: toWorkspaceResponse(created) }, 201);
};

const getWorkspace = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const [workspace] = await findOwnedWorkspace(db, id, userId);

  if (!workspace) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  return c.json({ workspace: toWorkspaceResponse(workspace) });
};

const updateWorkspaceHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateWorkspaceInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const updates: Partial<WorkspaceRow> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.type !== undefined) updates.type = input.type;

  const [updated] = await db
    .update(workspaces)
    .set(updates)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  return c.json({ workspace: toWorkspaceResponse(updated) });
};

const deleteWorkspaceHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const [deleted] = await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  return c.json({ success: true });
};

export const workspacesRoute = new Hono<AppEnv>()
  .get("/", zValidator("query", workspaceFilterSchema), listWorkspaces)
  .post("/", zValidator("json", createWorkspaceSchema), createWorkspaceHandler)
  .get("/:id", getWorkspace)
  .put(
    "/:id",
    zValidator("json", updateWorkspaceSchema),
    updateWorkspaceHandler,
  )
  .delete("/:id", deleteWorkspaceHandler);
