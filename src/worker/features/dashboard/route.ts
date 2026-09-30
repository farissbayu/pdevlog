import { count, desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";

import type { WorkspaceResponse } from "@/shared/schemas/workspace";
import { createDb } from "@/worker/db";
import { bragLogs, workspaces, type WorkspaceRow } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

const RECENT_WORKSPACES_LIMIT = 5;

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

const getDashboard = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const [workspaceCount, bragLogCount, recent] = await Promise.all([
    db
      .select({ value: count() })
      .from(workspaces)
      .where(eq(workspaces.userId, userId)),
    db
      .select({ value: count() })
      .from(bragLogs)
      .where(eq(bragLogs.userId, userId)),
    db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, userId))
      .orderBy(desc(workspaces.updatedAt))
      .limit(RECENT_WORKSPACES_LIMIT),
  ]);

  return c.json({
    stats: {
      workspaces: workspaceCount[0]?.value ?? 0,
      bragLogs: bragLogCount[0]?.value ?? 0,
      learningNotes: 0,
    },
    recentWorkspaces: recent.map(toWorkspaceResponse),
  });
};

export const dashboardRoute = new Hono<AppEnv>().get("/", getDashboard);
