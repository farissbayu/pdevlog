import { and, count, desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";

import type {
  ActivityItem,
  RecentActivityResponse,
} from "@/shared/schemas/dashboard";
import { sparkTitle } from "@/shared/schemas/spark";
import { createDb } from "@/worker/db";
import { bragLogs, notes, sparks, workspaces } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { loadTagsByOwnerIds, toTagResponse } from "@/worker/features/tags/helpers";
import { toWorkspaceResponse } from "@/worker/features/workspaces/helpers";

const RECENT_WORKSPACES_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 5;

const getDashboard = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const [workspaceCount, bragLogCount, noteCount, sparkCount, recent] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(workspaces)
        .where(eq(workspaces.userId, userId)),
      db
        .select({ value: count() })
        .from(bragLogs)
        .where(eq(bragLogs.userId, userId)),
      db
        .select({ value: count() })
        .from(notes)
        .where(eq(notes.userId, userId)),
      db
        .select({ value: count() })
        .from(sparks)
        .where(and(eq(sparks.userId, userId), eq(sparks.status, "open"))),
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
      notes: noteCount[0]?.value ?? 0,
      sparks: sparkCount[0]?.value ?? 0,
    },
    recentWorkspaces: recent.map((workspace) => toWorkspaceResponse(workspace)),
  });
};

const getRecentActivity = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const [logRows, noteRows, sparkRows] = await Promise.all([
    db
      .select({ log: bragLogs, workspace: workspaces })
      .from(bragLogs)
      .leftJoin(
        workspaces,
        and(
          eq(bragLogs.workspaceId, workspaces.id),
          eq(workspaces.userId, userId),
        ),
      )
      .where(eq(bragLogs.userId, userId))
      .orderBy(desc(bragLogs.createdAt))
      .limit(RECENT_ACTIVITY_LIMIT),
    db
      .select({ note: notes, workspace: workspaces })
      .from(notes)
      .leftJoin(
        workspaces,
        and(
          eq(notes.workspaceId, workspaces.id),
          eq(workspaces.userId, userId),
        ),
      )
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.createdAt))
      .limit(RECENT_ACTIVITY_LIMIT),
    db
      .select()
      .from(sparks)
      .where(eq(sparks.userId, userId))
      .orderBy(desc(sparks.createdAt))
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  const [logTags, noteTagsMap, sparkTagsMap] = await Promise.all([
    loadTagsByOwnerIds(
      db,
      "brag-log",
      logRows.map((row) => row.log.id),
      userId,
    ),
    loadTagsByOwnerIds(
      db,
      "note",
      noteRows.map((row) => row.note.id),
      userId,
    ),
    loadTagsByOwnerIds(
      db,
      "spark",
      sparkRows.map((row) => row.id),
      userId,
    ),
  ]);

  const items: ActivityItem[] = [
    ...logRows.map((row) => ({
      id: row.log.id,
      type: "brag-log" as const,
      title: row.log.title,
      date: new Date(row.log.createdAt).toISOString(),
      tags: (logTags.get(row.log.id) ?? []).map(toTagResponse),
      workspace: row.workspace ? toWorkspaceResponse(row.workspace) : null,
    })),
    ...noteRows.map((row) => ({
      id: row.note.id,
      type: "note" as const,
      title: row.note.title,
      date: new Date(row.note.createdAt).toISOString(),
      tags: (noteTagsMap.get(row.note.id) ?? []).map(toTagResponse),
      workspace: row.workspace ? toWorkspaceResponse(row.workspace) : null,
    })),
    ...sparkRows.map((row) => ({
      id: row.id,
      type: "spark" as const,
      title: sparkTitle(row.content),
      date: new Date(row.createdAt).toISOString(),
      tags: (sparkTagsMap.get(row.id) ?? []).map(toTagResponse),
      workspace: null,
    })),
  ];

  items.sort((a, b) => b.date.localeCompare(a.date));

  return c.json({
    items: items.slice(0, RECENT_ACTIVITY_LIMIT),
  } satisfies RecentActivityResponse);
};

export const dashboardRoute = new Hono<AppEnv>()
  .get("/", getDashboard)
  .get("/recent", getRecentActivity);
