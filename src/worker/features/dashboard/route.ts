import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Hono, type Context } from "hono";

import type {
  ActivityItem,
  RecentActivityResponse,
} from "@/shared/schemas/dashboard";
import type { TagResponse } from "@/shared/schemas/tag";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";
import { createDb, type Database } from "@/worker/db";
import {
  bragLogs,
  bragTags,
  learningNotes,
  noteTags,
  tags,
  workspaces,
  type TagRow,
  type WorkspaceRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

const RECENT_WORKSPACES_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 10;

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

function groupTags<Key extends string>(
  rows: { key: Key; tag: TagRow }[],
): Map<Key, TagRow[]> {
  const map = new Map<Key, TagRow[]>();
  for (const row of rows) {
    const list = map.get(row.key) ?? [];
    list.push(row.tag);
    map.set(row.key, list);
  }
  return map;
}

async function loadBragTags(
  db: Database,
  ids: string[],
  userId: string,
): Promise<Map<string, TagRow[]>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ key: bragTags.bragLogId, tag: tags })
    .from(bragTags)
    .innerJoin(tags, eq(bragTags.tagId, tags.id))
    .where(and(inArray(bragTags.bragLogId, ids), eq(tags.userId, userId)));
  return groupTags(rows);
}

async function loadNoteTags(
  db: Database,
  ids: string[],
  userId: string,
): Promise<Map<string, TagRow[]>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ key: noteTags.learningNoteId, tag: tags })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(and(inArray(noteTags.learningNoteId, ids), eq(tags.userId, userId)));
  return groupTags(rows);
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

const getRecentActivity = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const [logRows, noteRows] = await Promise.all([
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
      .select({ note: learningNotes, workspace: workspaces })
      .from(learningNotes)
      .leftJoin(
        workspaces,
        and(
          eq(learningNotes.workspaceId, workspaces.id),
          eq(workspaces.userId, userId),
        ),
      )
      .where(eq(learningNotes.userId, userId))
      .orderBy(desc(learningNotes.createdAt))
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  const [logTags, noteTagsMap] = await Promise.all([
    loadBragTags(
      db,
      logRows.map((row) => row.log.id),
      userId,
    ),
    loadNoteTags(
      db,
      noteRows.map((row) => row.note.id),
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
      type: "learning-note" as const,
      title: row.note.title,
      date: new Date(row.note.createdAt).toISOString(),
      tags: (noteTagsMap.get(row.note.id) ?? []).map(toTagResponse),
      workspace: row.workspace ? toWorkspaceResponse(row.workspace) : null,
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
