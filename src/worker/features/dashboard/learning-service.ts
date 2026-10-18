import { and, desc, eq, gte } from "drizzle-orm";

import type { SuggestionSource } from "@/shared/schemas/learning-suggestion";
import type { Database } from "@/worker/db";
import {
  bragLogs,
  notes,
  projectItems,
  projects,
  userProfiles,
} from "@/worker/db/schema";

const SEVEN_DAYS_MS = 7 * 86_400_000;
const MAX_CONTEXT_ITEMS = 15;
const MAX_CONTEXT_CHARS = 6_000;

type ContextEvent = {
  id: string;
  date: number;
  text: string;
  source: SuggestionSource;
};

function parsePrimaryStack(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

async function loadEvents(
  db: Database,
  userId: string,
  since: Date | null,
  limit: number,
): Promise<ContextEvent[]> {
  const [logRows, noteRows, itemRows] = await Promise.all([
    db
      .select({
        id: bragLogs.id,
        title: bragLogs.title,
        action: bragLogs.action,
        result: bragLogs.result,
        createdAt: bragLogs.createdAt,
      })
      .from(bragLogs)
      .where(
        and(
          eq(bragLogs.userId, userId),
          since ? gte(bragLogs.createdAt, since) : undefined,
        ),
      )
      .orderBy(desc(bragLogs.createdAt))
      .limit(limit),
    db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          since ? gte(notes.updatedAt, since) : undefined,
        ),
      )
      .orderBy(desc(notes.updatedAt))
      .limit(limit),
    db
      .select({
        id: projectItems.id,
        title: projectItems.title,
        kind: projectItems.kind,
        status: projectItems.status,
        projectName: projects.name,
        updatedAt: projectItems.updatedAt,
      })
      .from(projectItems)
      .innerJoin(projects, eq(projectItems.projectId, projects.id))
      .where(
        and(
          eq(projectItems.userId, userId),
          since ? gte(projectItems.updatedAt, since) : undefined,
        ),
      )
      .orderBy(desc(projectItems.updatedAt))
      .limit(limit),
  ]);

  return [
    ...logRows.map((log) => ({
      id: log.id,
      date: log.createdAt.getTime(),
      text: `[Brag Log] "${log.title}": Action: ${log.action} -> Result: ${log.result}`,
      source: { kind: "brag-log" as const, title: log.title },
    })),
    ...noteRows.map((note) => ({
      id: note.id,
      date: note.updatedAt.getTime(),
      text: `[Note] "${note.title}": ${note.content.slice(0, 300)}`,
      source: { kind: "note" as const, title: note.title },
    })),
    ...itemRows.map((item) => ({
      id: item.id,
      date: item.updatedAt.getTime(),
      text: `[Project Item in "${item.projectName}"] (${item.kind}, ${item.status}): ${item.title}`,
      source: { kind: "project-item" as const, title: item.title },
    })),
  ];
}

function sortAndCap(events: ContextEvent[]): ContextEvent[] {
  return [...events]
    .sort((a, b) => b.date - a.date)
    .slice(0, MAX_CONTEXT_ITEMS);
}

function formatEvents(events: ContextEvent[]): string {
  return events
    .map(
      (event) =>
        `- ${new Date(event.date).toISOString().slice(0, 10)} ${event.text}`,
    )
    .join("\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

export type LearningContext = {
  context: string;
  recentItems: number;
  sources: SuggestionSource[];
};

export async function loadLearningContext(
  db: Database,
  userId: string,
): Promise<LearningContext> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const recent = await loadEvents(db, userId, since, MAX_CONTEXT_ITEMS);

  if (recent.length >= 2) {
    const items = sortAndCap(recent);
    return {
      context: formatEvents(items),
      recentItems: recent.length,
      sources: items.map((event) => event.source),
    };
  }

  // Cold start: fewer than 2 items this week, fall back to the latest work.
  const fallback = await loadEvents(db, userId, null, MAX_CONTEXT_ITEMS);
  const recentIds = new Set(recent.map((event) => event.id));
  const older = fallback.filter((event) => !recentIds.has(event.id));
  const combined = [...recent, ...older].slice(0, 5);

  if (combined.length > 0) {
    const items = sortAndCap(combined);
    return {
      context: [
        "No devlog activity in the last 7 days. Here is the engineer's most recent work:",
        formatEvents(items),
      ].join("\n"),
      recentItems: recent.length,
      sources: items.map((event) => event.source),
    };
  }

  const [profile] = await db
    .select({ primaryStack: userProfiles.primaryStack })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  const stack = parsePrimaryStack(profile?.primaryStack);

  return {
    context: [
      "The engineer has not logged any devlog activity yet.",
      stack.length > 0 ? `Their primary stack: ${stack.join(", ")}.` : "",
      "Recommend a foundational, high-leverage topic to start their learning log.",
    ]
      .filter(Boolean)
      .join(" "),
    recentItems: 0,
    sources: [],
  };
}

export async function hasRecentActivity(
  db: Database,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);

  const [log, note, item] = await Promise.all([
    db
      .select({ id: bragLogs.id })
      .from(bragLogs)
      .where(and(eq(bragLogs.userId, userId), gte(bragLogs.createdAt, since)))
      .limit(1),
    db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.userId, userId), gte(notes.updatedAt, since)))
      .limit(1),
    db
      .select({ id: projectItems.id })
      .from(projectItems)
      .where(
        and(eq(projectItems.userId, userId), gte(projectItems.updatedAt, since)),
      )
      .limit(1),
  ]);

  return log.length > 0 || note.length > 0 || item.length > 0;
}
