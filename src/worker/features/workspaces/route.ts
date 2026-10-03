import { zValidator } from "@hono/zod-validator";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
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
import type { SourceResponse } from "@/shared/schemas/source";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type WorkspaceResponse,
} from "@/shared/schemas/workspace";
import { createDb, type Database } from "@/worker/db";
import {
  notes,
  sources,
  workspaces,
  type SourceRow,
  type WorkspaceRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

type JsonInput<T> = { in: { json: T }; out: { json: T } };
type QueryInput<T> = { in: { query: T }; out: { query: T } };

function toSourceResponse(source: SourceRow): SourceResponse {
  return {
    id: source.id,
    url: source.url,
    label: source.label,
    kind: source.kind,
    locator: source.locator,
  };
}

function toWorkspaceResponse(
  workspace: WorkspaceRow,
  sourceRows: SourceRow[] = [],
): WorkspaceResponse {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    type: workspace.type,
    sources: sourceRows.map(toSourceResponse),
    createdAt: new Date(workspace.createdAt).toISOString(),
    updatedAt: new Date(workspace.updatedAt).toISOString(),
  };
}

function loadWorkspaceSources(
  db: Database,
  ownerIds: string[],
  userId: string,
): Promise<Map<string, SourceRow[]>> {
  const map = new Map<string, SourceRow[]>();
  if (ownerIds.length === 0) {
    return Promise.resolve(map);
  }

  return db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.ownerType, "workspace"),
        inArray(sources.ownerId, ownerIds),
        eq(sources.userId, userId),
      ),
    )
    .orderBy(sources.position, sources.createdAt)
    .then((rows) => {
      for (const row of rows) {
        const list = map.get(row.ownerId) ?? [];
        list.push(row);
        map.set(row.ownerId, list);
      }
      return map;
    });
}

function workspaceSourceStatements(
  db: ReturnType<typeof createDb>,
  workspaceId: string,
  userId: string,
  sourceInputs: CreateWorkspaceInput["sources"],
  now: Date,
): BatchItem<"sqlite">[] {
  if (sourceInputs === undefined) {
    return [];
  }
  const list = sourceInputs ?? [];
  return [
    db
      .delete(sources)
      .where(
        and(
          eq(sources.ownerType, "workspace"),
          eq(sources.ownerId, workspaceId),
        ),
      ),
    ...list.map((source, index) =>
      db.insert(sources).values({
        id: nanoid(),
        userId,
        ownerType: "workspace",
        ownerId: workspaceId,
        url: source.url ?? null,
        label: source.label ?? null,
        kind: source.kind ?? null,
        locator: source.locator ?? null,
        position: index,
        createdAt: now,
      }),
    ),
  ];
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

  const sourcesByWorkspaceId = await loadWorkspaceSources(
    db,
    rows.map((workspace) => workspace.id),
    userId,
  );

  return c.json({
    workspaces: rows.map((workspace) =>
      toWorkspaceResponse(
        workspace,
        sourcesByWorkspaceId.get(workspace.id) ?? [],
      ),
    ),
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
  const workspaceId = nanoid();

  const statements: BatchItem<"sqlite">[] = [
    db.insert(workspaces).values({
      id: workspaceId,
      userId,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      createdAt: now,
      updatedAt: now,
    }),
    ...workspaceSourceStatements(
      db,
      workspaceId,
      userId,
      input.sources,
      now,
    ),
  ];

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  const [created] = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)),
    )
    .limit(1);

  const createdSources = await loadWorkspaceSources(db, [workspaceId], userId);

  return c.json(
    {
      workspace: toWorkspaceResponse(
        created,
        createdSources.get(workspaceId) ?? [],
      ),
    },
    201,
  );
};

const getWorkspace = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const [workspace] = await findOwnedWorkspace(db, id, userId);

  if (!workspace) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const workspaceSources = await loadWorkspaceSources(db, [id], userId);

  return c.json({
    workspace: toWorkspaceResponse(workspace, workspaceSources.get(id) ?? []),
  });
};

const updateWorkspaceHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateWorkspaceInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const [existing] = await findOwnedWorkspace(db, id, userId);
  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const now = new Date();
  const updates: Partial<WorkspaceRow> = { updatedAt: now };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.type !== undefined) updates.type = input.type;

  const statements: BatchItem<"sqlite">[] = [
    db
      .update(workspaces)
      .set(updates)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId))),
    ...workspaceSourceStatements(db, id, userId, input.sources, now),
  ];

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  const [updated] = await findOwnedWorkspace(db, id, userId);
  const workspaceSources = await loadWorkspaceSources(db, [id], userId);

  return c.json({
    workspace: toWorkspaceResponse(
      updated ?? existing,
      workspaceSources.get(id) ?? [],
    ),
  });
};

const deleteWorkspaceHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const [owned] = await findOwnedWorkspace(db, id, userId);
  if (!owned) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const statements: BatchItem<"sqlite">[] = [
    db
      .delete(sources)
      .where(
        and(eq(sources.ownerType, "workspace"), eq(sources.ownerId, id)),
      ),
    db
      .delete(sources)
      .where(
        and(
          eq(sources.ownerType, "note"),
          eq(sources.userId, userId),
          inArray(
            sources.ownerId,
            db
              .select({ id: notes.id })
              .from(notes)
              .where(eq(notes.workspaceId, id)),
          ),
        ),
      ),
    db
      .delete(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId))),
  ];

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

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
