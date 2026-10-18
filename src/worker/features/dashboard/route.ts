import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  checkInsQuerySchema,
  type CheckInsQuery,
  type CheckInsResponse,
} from "@/shared/schemas/check-in";
import type {
  ActivityItem,
  RecentActivityResponse,
} from "@/shared/schemas/dashboard";
import {
  dailySuggestionQuerySchema,
  MAX_DAILY_REGENERATIONS,
  parseSuggestionSources,
  suggestionActionSchema,
  suggestionTzBodySchema,
  type DailyLearningSuggestion,
  type DailySuggestionQuery,
  type DailySuggestionResponse,
  type SuggestionActionInput,
  type SuggestionSource,
  type SuggestionTzBody,
} from "@/shared/schemas/learning-suggestion";
import { sparkTitle } from "@/shared/schemas/spark";
import { createDb } from "@/worker/db";
import {
  aiUsage,
  bragLogs,
  dailyLearningSuggestions,
  notes,
  sparks,
  workspaces,
  type DailyLearningSuggestionRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { loadTagsByOwnerIds, toTagResponse } from "@/worker/features/tags/helpers";
import { toWorkspaceResponse } from "@/worker/features/workspaces/helpers";
import {
  DailyLearningSuggestionError,
  generateDailyLearningSuggestion,
} from "@/worker/lib/ai-client";

import { hasRecentActivity, loadLearningContext } from "./learning-service";
import { computeStreaks, loadActiveDays, localDayKey } from "./service";

type QueryInput<T> = { in: { query: T }; out: { query: T } };
type JsonInput<T> = { in: { json: T }; out: { json: T } };

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

const getCheckIns = async (
  c: Context<AppEnv, "/check-ins", QueryInput<CheckInsQuery>>,
) => {
  const userId = c.get("userId");
  const { tz_offset: tzOffset } = c.req.valid("query");
  const db = createDb(c.env.DB);

  const days = await loadActiveDays(db, userId, tzOffset);
  const streaks = computeStreaks(
    days.map((day) => day.date),
    localDayKey(Date.now(), tzOffset),
  );

  return c.json({
    days,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    todayActive: streaks.todayActive,
  } satisfies CheckInsResponse);
};

function toSuggestionResponse(
  row: DailyLearningSuggestionRow,
): DailyLearningSuggestion {
  let suggestedTags: string[] = [];
  if (row.suggestedTags) {
    try {
      const parsed: unknown = JSON.parse(row.suggestedTags);
      if (Array.isArray(parsed)) {
        suggestedTags = parsed.filter(
          (tag): tag is string => typeof tag === "string",
        );
      }
    } catch {
      suggestedTags = [];
    }
  }

  return {
    id: row.id,
    date: row.date,
    title: row.title,
    category: row.category,
    reason: row.reason,
    practicalNextStep: row.practicalNextStep,
    suggestedOutline: row.suggestedOutline,
    suggestedTags,
    sourceItems: parseSuggestionSources(row.sourceItems),
    sourceContextSummary: row.sourceContextSummary,
    regenerateCount: row.regenerateCount,
    regenerationsLeft: Math.max(
      0,
      MAX_DAILY_REGENERATIONS - row.regenerateCount,
    ),
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

async function findTodaySuggestion(
  db: ReturnType<typeof createDb>,
  userId: string,
  todayKey: string,
): Promise<DailyLearningSuggestionRow | undefined> {
  const [row] = await db
    .select()
    .from(dailyLearningSuggestions)
    .where(
      and(
        eq(dailyLearningSuggestions.userId, userId),
        eq(dailyLearningSuggestions.date, todayKey),
      ),
    )
    .limit(1);
  return row;
}

function parsePreviousTitles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((title): title is string => typeof title === "string")
      : [];
  } catch {
    return [];
  }
}

async function loadAvoidTitles(
  db: ReturnType<typeof createDb>,
  userId: string,
  extra: string[],
): Promise<string[]> {
  const rows = await db
    .select({ title: dailyLearningSuggestions.title })
    .from(dailyLearningSuggestions)
    .where(eq(dailyLearningSuggestions.userId, userId))
    .orderBy(desc(dailyLearningSuggestions.updatedAt))
    .limit(5);

  return [...new Set([...extra, ...rows.map((row) => row.title)])].slice(0, 10);
}

function pickCitedSources(
  usedSourceTitles: string[],
  sources: SuggestionSource[],
): SuggestionSource[] {
  const byTitle = new Map(sources.map((source) => [source.title, source]));
  const seen = new Set<string>();
  const picked: SuggestionSource[] = [];
  for (const title of usedSourceTitles) {
    const source = byTitle.get(title);
    if (!source) continue;
    const key = `${source.kind}:${source.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(source);
  }
  return picked;
}

async function recordAiUsage(
  db: ReturnType<typeof createDb>,
  userId: string,
  usage: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  },
): Promise<void> {
  try {
    await db.insert(aiUsage).values({
      id: nanoid(),
      userId,
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to record AI usage for learning suggestion:", error);
  }
}

const getLearningSuggestion = async (
  c: Context<AppEnv, "/learning-suggestion", QueryInput<DailySuggestionQuery>>,
) => {
  const userId = c.get("userId");
  const { tz_offset: tzOffset } = c.req.valid("query");
  const db = createDb(c.env.DB);
  const todayKey = localDayKey(Date.now(), tzOffset);

  const [row, recent] = await Promise.all([
    findTodaySuggestion(db, userId, todayKey),
    hasRecentActivity(db, userId),
  ]);

  return c.json({
    suggestion: row ? toSuggestionResponse(row) : null,
    hasRecentActivity: recent,
    todayKey,
    regenerationsLeft: row
      ? Math.max(0, MAX_DAILY_REGENERATIONS - row.regenerateCount)
      : MAX_DAILY_REGENERATIONS,
  } satisfies DailySuggestionResponse);
};

const generateLearningSuggestion = async (
  c: Context<
    AppEnv,
    "/learning-suggestion/generate",
    JsonInput<SuggestionTzBody>
  >,
) => {
  const userId = c.get("userId");
  const { tz_offset: tzOffset } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const todayKey = localDayKey(Date.now(), tzOffset);

  const existing = await findTodaySuggestion(db, userId, todayKey);
  if (existing) {
    return c.json({
      suggestion: toSuggestionResponse(existing),
      hasRecentActivity: await hasRecentActivity(db, userId),
      todayKey,
      regenerationsLeft: Math.max(
        0,
        MAX_DAILY_REGENERATIONS - existing.regenerateCount,
      ),
    } satisfies DailySuggestionResponse);
  }

  const { context, recentItems, sources } = await loadLearningContext(db, userId);
  const avoidTitles = await loadAvoidTitles(db, userId, []);

  try {
    const { suggestion, usage } = await generateDailyLearningSuggestion(
      c.env,
      context,
      { avoidTitles },
    );

    const now = new Date();
    const id = nanoid();
    await db.insert(dailyLearningSuggestions).values({
      id,
      userId,
      date: todayKey,
      title: suggestion.title,
      category: suggestion.category,
      reason: suggestion.reason,
      practicalNextStep: suggestion.practicalNextStep,
      suggestedOutline: suggestion.suggestedOutline,
      suggestedTags: JSON.stringify(suggestion.suggestedTags),
      sourceItems: JSON.stringify(
        pickCitedSources(suggestion.usedSourceTitles, sources),
      ),
      sourceContextSummary: suggestion.sourceContextSummary,
      regenerateCount: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await recordAiUsage(db, userId, usage);

    const created = await findTodaySuggestion(db, userId, todayKey);
    return c.json(
      {
        suggestion: created ? toSuggestionResponse(created) : null,
        hasRecentActivity: recentItems > 0,
        todayKey,
        regenerationsLeft: MAX_DAILY_REGENERATIONS,
      } satisfies DailySuggestionResponse,
      201,
    );
  } catch (error) {
    if (error instanceof DailyLearningSuggestionError) {
      return c.json({ error: error.message }, 502);
    }
    throw error;
  }
};

const regenerateLearningSuggestion = async (
  c: Context<
    AppEnv,
    "/learning-suggestion/regenerate",
    JsonInput<SuggestionTzBody>
  >,
) => {
  const userId = c.get("userId");
  const { tz_offset: tzOffset } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const todayKey = localDayKey(Date.now(), tzOffset);

  const existing = await findTodaySuggestion(db, userId, todayKey);
  if (!existing) {
    return c.json({ error: "No learning suggestion to regenerate today" }, 404);
  }
  if (existing.regenerateCount >= MAX_DAILY_REGENERATIONS) {
    return c.json(
      {
        error: `Daily regeneration limit reached (${MAX_DAILY_REGENERATIONS}/${MAX_DAILY_REGENERATIONS}). Resets tomorrow.`,
      },
      400,
    );
  }

  const { context, recentItems, sources } = await loadLearningContext(db, userId);
  const avoidTitles = await loadAvoidTitles(db, userId, [
    ...parsePreviousTitles(existing.previousTitles),
    existing.title,
  ]);

  try {
    const { suggestion, usage } = await generateDailyLearningSuggestion(
      c.env,
      context,
      { regenerate: true, avoidTitles },
    );

    const now = new Date();
    const regenerateCount = existing.regenerateCount + 1;
    await db
      .update(dailyLearningSuggestions)
      .set({
        title: suggestion.title,
        category: suggestion.category,
        reason: suggestion.reason,
        practicalNextStep: suggestion.practicalNextStep,
        suggestedOutline: suggestion.suggestedOutline,
        suggestedTags: JSON.stringify(suggestion.suggestedTags),
        sourceItems: JSON.stringify(
          pickCitedSources(suggestion.usedSourceTitles, sources),
        ),
        previousTitles: JSON.stringify([
          ...parsePreviousTitles(existing.previousTitles),
          existing.title,
        ]),
        sourceContextSummary: suggestion.sourceContextSummary,
        regenerateCount,
        updatedAt: now,
      })
      .where(
        and(
          eq(dailyLearningSuggestions.id, existing.id),
          eq(dailyLearningSuggestions.userId, userId),
        ),
      );
    await recordAiUsage(db, userId, usage);

    const updated = await findTodaySuggestion(db, userId, todayKey);
    return c.json({
      suggestion: updated ? toSuggestionResponse(updated) : null,
      hasRecentActivity: recentItems > 0,
      todayKey,
      regenerationsLeft: Math.max(0, MAX_DAILY_REGENERATIONS - regenerateCount),
    } satisfies DailySuggestionResponse);
  } catch (error) {
    if (error instanceof DailyLearningSuggestionError) {
      return c.json({ error: error.message }, 502);
    }
    throw error;
  }
};

const updateLearningSuggestionAction = async (
  c: Context<
    AppEnv,
    "/learning-suggestion/:id/action",
    JsonInput<SuggestionActionInput>
  >,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { status } = c.req.valid("json");
  const db = createDb(c.env.DB);

  const [row] = await db
    .select()
    .from(dailyLearningSuggestions)
    .where(
      and(
        eq(dailyLearningSuggestions.id, id),
        eq(dailyLearningSuggestions.userId, userId),
      ),
    )
    .limit(1);
  if (!row) {
    return c.json({ error: "Learning suggestion not found" }, 404);
  }

  await db
    .update(dailyLearningSuggestions)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(dailyLearningSuggestions.id, id),
        eq(dailyLearningSuggestions.userId, userId),
      ),
    );

  return c.json({
    suggestion: toSuggestionResponse({ ...row, status }),
  });
};

export const dashboardRoute = new Hono<AppEnv>()
  .get("/", getDashboard)
  .get("/recent", getRecentActivity)
  .get("/check-ins", zValidator("query", checkInsQuerySchema), getCheckIns)
  .get(
    "/learning-suggestion",
    zValidator("query", dailySuggestionQuerySchema),
    getLearningSuggestion,
  )
  .post(
    "/learning-suggestion/generate",
    zValidator("json", suggestionTzBodySchema),
    generateLearningSuggestion,
  )
  .post(
    "/learning-suggestion/regenerate",
    zValidator("json", suggestionTzBodySchema),
    regenerateLearningSuggestion,
  )
  .post(
    "/learning-suggestion/:id/action",
    zValidator("json", suggestionActionSchema),
    updateLearningSuggestionAction,
  );
