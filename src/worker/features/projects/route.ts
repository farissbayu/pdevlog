import { zValidator } from "@hono/zod-validator";
import {
  and,
  asc,
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
import { z } from "zod";

import {
  buildPaginationMeta,
  parsePagination,
} from "@/shared/schemas/pagination";
import {
  createProjectItemSchema,
  createProjectSchema,
  projectItemStatusSchema,
  shipProjectItemSchema,
  updateProjectItemSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type CreateProjectItemInput,
  type ProjectItemResponse,
  type ProjectResponse,
  type ShipProjectItemInput,
  type UpdateProjectInput,
  type UpdateProjectItemInput,
} from "@/shared/schemas/project";
import { createDb, type Database } from "@/worker/db";
import {
  projectItems,
  projects,
  sparks,
  workspaces,
  type ProjectItemRow,
  type ProjectRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

type JsonInput<T> = { in: { json: T }; out: { json: T } };
type QueryInput<T> = { in: { query: T }; out: { query: T } };

const listProjectsQuerySchema = z.object({
  workspace_id: z.string().min(1).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  page_size: z.string().regex(/^\d+$/).optional(),
});

const listItemsQuerySchema = z.object({
  status: projectItemStatusSchema.optional(),
});

function toProjectResponse(
  project: ProjectRow,
  counts: { backlog: number; shipped: number } = { backlog: 0, shipped: 0 },
): ProjectResponse {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    tagline: project.tagline,
    description: project.description,
    repoUrl: project.repoUrl,
    liveUrl: project.liveUrl,
    status: project.status,
    backlogCount: counts.backlog,
    shippedCount: counts.shipped,
    createdAt: new Date(project.createdAt).toISOString(),
    updatedAt: new Date(project.updatedAt).toISOString(),
  };
}

function toProjectItemResponse(item: ProjectItemRow): ProjectItemResponse {
  return {
    id: item.id,
    projectId: item.projectId,
    title: item.title,
    description: item.description,
    kind: item.kind,
    status: item.status,
    targetVersion: item.targetVersion,
    position: item.position,
    shippedAt: item.shippedAt ? new Date(item.shippedAt).toISOString() : null,
    shippedVersion: item.shippedVersion,
    bragLogId: item.bragLogId,
    noteId: item.noteId,
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
  };
}

async function findOwnedProject(
  db: Database,
  id: string,
  userId: string,
): Promise<ProjectRow | undefined> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return project;
}

async function loadItemCounts(
  db: Database,
  projectIds: string[],
  userId: string,
): Promise<Map<string, { backlog: number; shipped: number }>> {
  const map = new Map<string, { backlog: number; shipped: number }>();
  if (projectIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      projectId: projectItems.projectId,
      status: projectItems.status,
      value: count(),
    })
    .from(projectItems)
    .where(
      and(
        eq(projectItems.userId, userId),
        inArray(projectItems.projectId, projectIds),
      ),
    )
    .groupBy(projectItems.projectId, projectItems.status);

  for (const row of rows) {
    const entry = map.get(row.projectId) ?? { backlog: 0, shipped: 0 };
    if (row.status === "shipped") {
      entry.shipped += row.value;
    } else if (row.status === "backlog" || row.status === "in_progress") {
      entry.backlog += row.value;
    }
    map.set(row.projectId, entry);
  }
  return map;
}

async function validateWorkspaceOwnership(
  db: Database,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1);
  return Boolean(workspace);
}

const listProjects = async (
  c: Context<AppEnv, "/", QueryInput<z.infer<typeof listProjectsQuerySchema>>>,
) => {
  const userId = c.get("userId");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(projects.userId, userId)];
  if (filters.workspace_id) {
    conditions.push(eq(projects.workspaceId, filters.workspace_id));
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(
      like(projects.name, pattern),
      like(projects.tagline, pattern),
    );
    if (search) {
      conditions.push(search);
    }
  }

  const where = and(...conditions);
  const { page, pageSize } = parsePagination(filters);

  const query = db
    .select()
    .from(projects)
    .where(where)
    .orderBy(desc(projects.updatedAt), desc(projects.id));

  const [rows, totalRows] = await Promise.all([
    page === null ? query : query.limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(projects).where(where),
  ]);
  const total = totalRows[0]?.value ?? 0;

  const counts = await loadItemCounts(
    db,
    rows.map((row) => row.id),
    userId,
  );

  return c.json({
    projects: rows.map((row) =>
      toProjectResponse(row, counts.get(row.id) ?? { backlog: 0, shipped: 0 }),
    ),
    pagination: buildPaginationMeta(total, page, pageSize),
  });
};

const createProjectHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateProjectInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  if (!(await validateWorkspaceOwnership(db, input.workspace_id, userId))) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const now = new Date();
  const projectId = nanoid();
  await db.insert(projects).values({
    id: projectId,
    userId,
    workspaceId: input.workspace_id,
    name: input.name,
    tagline: input.tagline ?? null,
    description: input.description ?? null,
    repoUrl: input.repo_url ?? null,
    liveUrl: input.live_url ?? null,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  return c.json({ project: toProjectResponse(created) }, 201);
};

const getProject = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const project = await findOwnedProject(db, id, userId);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const counts = await loadItemCounts(db, [id], userId);
  return c.json({
    project: toProjectResponse(project, counts.get(id) ?? { backlog: 0, shipped: 0 }),
  });
};

const updateProjectHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateProjectInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedProject(db, id, userId);
  if (!owned) {
    return c.json({ error: "Project not found" }, 404);
  }

  const updates: Partial<ProjectRow> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.tagline !== undefined) updates.tagline = input.tagline;
  if (input.description !== undefined) updates.description = input.description;
  if (input.repo_url !== undefined) updates.repoUrl = input.repo_url;
  if (input.live_url !== undefined) updates.liveUrl = input.live_url;
  if (input.status !== undefined) updates.status = input.status;

  await db
    .update(projects)
    .set(updates)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  const updated = await findOwnedProject(db, id, userId);
  const counts = await loadItemCounts(db, [id], userId);
  return c.json({
    project: toProjectResponse(updated!, counts.get(id) ?? { backlog: 0, shipped: 0 }),
  });
};

const deleteProjectHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const owned = await findOwnedProject(db, id, userId);
  if (!owned) {
    return c.json({ error: "Project not found" }, 404);
  }

  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  return c.json({ success: true });
};

const listProjectItems = async (
  c: Context<
    AppEnv,
    "/:id/items",
    QueryInput<z.infer<typeof listItemsQuerySchema>>
  >,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const project = await findOwnedProject(db, id, userId);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const conditions: SQL[] = [
    eq(projectItems.userId, userId),
    eq(projectItems.projectId, id),
  ];
  if (filters.status) {
    conditions.push(eq(projectItems.status, filters.status));
  }

  const orderBy =
    filters.status === "shipped"
      ? [desc(projectItems.shippedAt), desc(projectItems.createdAt)]
      : [asc(projectItems.targetVersion), asc(projectItems.createdAt)];

  const rows = await db
    .select()
    .from(projectItems)
    .where(and(...conditions))
    .orderBy(...orderBy);

  return c.json({ items: rows.map(toProjectItemResponse) });
};

const createProjectItemHandler = async (
  c: Context<AppEnv, "/:id/items", JsonInput<CreateProjectItemInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const project = await findOwnedProject(db, id, userId);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
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

  const itemId = nanoid();
  const now = new Date();

  const statements: BatchItem<"sqlite">[] = [
    db.insert(projectItems).values({
      id: itemId,
      userId,
      projectId: id,
      title: input.title,
      description: input.description ?? null,
      kind: input.kind ?? "feat",
      status: input.status ?? "backlog",
      targetVersion: input.target_version ?? "Next",
      createdAt: now,
      updatedAt: now,
    }),
  ];
  if (sparkId) {
    statements.push(
      db
        .update(sparks)
        .set({
          status: "promoted",
          promotedType: "project-item",
          promotedId: itemId,
          updatedAt: now,
        })
        .where(and(eq(sparks.id, sparkId), eq(sparks.userId, userId))),
    );
  }

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  const [created] = await db
    .select()
    .from(projectItems)
    .where(
      and(eq(projectItems.id, itemId), eq(projectItems.userId, userId)),
    )
    .limit(1);

  return c.json({ item: toProjectItemResponse(created) }, 201);
};

async function findOwnedItem(
  db: Database,
  projectId: string,
  itemId: string,
  userId: string,
): Promise<ProjectItemRow | undefined> {
  const [item] = await db
    .select()
    .from(projectItems)
    .where(
      and(
        eq(projectItems.id, itemId),
        eq(projectItems.projectId, projectId),
        eq(projectItems.userId, userId),
      ),
    )
    .limit(1);
  return item;
}

const updateProjectItemHandler = async (
  c: Context<AppEnv, "/:id/items/:itemId", JsonInput<UpdateProjectItemInput>>,
) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedItem(db, projectId, itemId, userId);
  if (!owned) {
    return c.json({ error: "Item not found" }, 404);
  }

  const updates: Partial<ProjectItemRow> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.kind !== undefined) updates.kind = input.kind;
  if (input.status !== undefined) updates.status = input.status;
  if (input.target_version !== undefined) {
    updates.targetVersion = input.target_version;
  }
  if (input.position !== undefined) updates.position = input.position;

  await db
    .update(projectItems)
    .set(updates)
    .where(and(eq(projectItems.id, itemId), eq(projectItems.userId, userId)));

  const updated = await findOwnedItem(db, projectId, itemId, userId);
  return c.json({ item: toProjectItemResponse(updated!) });
};

const shipProjectItemHandler = async (
  c: Context<
    AppEnv,
    "/:id/items/:itemId/ship",
    JsonInput<ShipProjectItemInput>
  >,
) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedItem(db, projectId, itemId, userId);
  if (!owned) {
    return c.json({ error: "Item not found" }, 404);
  }

  const now = new Date();
  await db
    .update(projectItems)
    .set({
      status: "shipped",
      shippedAt: now,
      shippedVersion: input.version ?? owned.targetVersion,
      updatedAt: now,
    })
    .where(and(eq(projectItems.id, itemId), eq(projectItems.userId, userId)));

  const updated = await findOwnedItem(db, projectId, itemId, userId);
  return c.json({ item: toProjectItemResponse(updated!) });
};

const deleteProjectItemHandler = async (
  c: Context<AppEnv, "/:id/items/:itemId">,
) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const db = createDb(c.env.DB);

  const owned = await findOwnedItem(db, projectId, itemId, userId);
  if (!owned) {
    return c.json({ error: "Item not found" }, 404);
  }

  await db
    .delete(projectItems)
    .where(and(eq(projectItems.id, itemId), eq(projectItems.userId, userId)));

  return c.json({ success: true });
};

const CHANGELOG_SECTIONS: Record<string, string> = {
  feat: "Added",
  fix: "Fixed",
  perf: "Performance",
  refactor: "Changed",
  docs: "Documentation",
  spike: "Research",
};

function buildChangelog(projectName: string, items: ProjectItemRow[]): string {
  const versions = new Map<string, ProjectItemRow[]>();
  for (const item of items) {
    const version = item.shippedVersion ?? "Unreleased";
    const list = versions.get(version) ?? [];
    list.push(item);
    versions.set(version, list);
  }

  const lines: string[] = [`# Changelog - ${projectName}`, ""];

  for (const [version, versionItems] of versions) {
    const shippedAt = versionItems[0]?.shippedAt;
    const date = shippedAt
      ? new Date(shippedAt).toISOString().slice(0, 10)
      : "";
    lines.push(date ? `## ${version} - ${date}` : `## ${version}`, "");

    const sections = new Map<string, string[]>();
    for (const item of versionItems) {
      const section = CHANGELOG_SECTIONS[item.kind] ?? "Changed";
      const list = sections.get(section) ?? [];
      list.push(item.title);
      sections.set(section, list);
    }

    for (const [section, titles] of sections) {
      lines.push(`### ${section}`);
      for (const title of titles) {
        lines.push(`- ${title}`);
      }
      lines.push("");
    }
  }

  if (items.length === 0) {
    lines.push("_No shipped items yet._", "");
  }

  return lines.join("\n");
}

const exportChangelog = async (c: Context<AppEnv, "/:id/changelog/export">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const project = await findOwnedProject(db, id, userId);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const items = await db
    .select()
    .from(projectItems)
    .where(
      and(
        eq(projectItems.userId, userId),
        eq(projectItems.projectId, id),
        eq(projectItems.status, "shipped"),
      ),
    )
    .orderBy(desc(projectItems.shippedAt), desc(projectItems.createdAt));

  return c.body(buildChangelog(project.name, items), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  });
};

export const projectsRoute = new Hono<AppEnv>()
  .get("/", zValidator("query", listProjectsQuerySchema), listProjects)
  .post("/", zValidator("json", createProjectSchema), createProjectHandler)
  .get("/:id", getProject)
  .put("/:id", zValidator("json", updateProjectSchema), updateProjectHandler)
  .delete("/:id", deleteProjectHandler)
  .get(
    "/:id/items",
    zValidator("query", listItemsQuerySchema),
    listProjectItems,
  )
  .post(
    "/:id/items",
    zValidator("json", createProjectItemSchema),
    createProjectItemHandler,
  )
  .put(
    "/:id/items/:itemId",
    zValidator("json", updateProjectItemSchema),
    updateProjectItemHandler,
  )
  .post(
    "/:id/items/:itemId/ship",
    zValidator("json", shipProjectItemSchema),
    shipProjectItemHandler,
  )
  .delete("/:id/items/:itemId", deleteProjectItemHandler)
  .get("/:id/changelog/export", exportChangelog);
