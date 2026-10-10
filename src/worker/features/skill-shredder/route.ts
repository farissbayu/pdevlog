import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  CHALLENGE_STEP_KEY,
  SPIKE_STEP_KEY,
  buildTilNoteContent,
  createSkillShredSchema,
  deriveSkillShredStatus,
  skillShredderInputSchema,
  skillShredderResultSchema,
  updateSkillProgressSchema,
  type CreateSkillShredInput,
  type SkillShredderInput,
  type SkillShredderResult,
  type UpdateSkillProgressInput,
} from "@/shared/schemas/skill-shredder";
import { createDb, type Database } from "@/worker/db";
import {
  aiUsage,
  notes,
  skillShreds,
  type SkillShredRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import {
  SkillShredderError,
  generateSkillShredder,
} from "@/worker/lib/ai-client";
import { rateLimit } from "@/worker/middleware/rate-limit";

type JsonInput<T> = { in: { json: T }; out: { json: T } };

function toIso(value: Date | number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function toSkillShredResponse(row: SkillShredRow) {
  return {
    id: row.id,
    topic: row.topic,
    currentContext: row.currentContext,
    targetTimeMinutes: row.targetTimeMinutes,
    toyProjectTitle: row.toyProjectTitle,
    blueprint: JSON.parse(row.blueprintJson) as SkillShredderResult,
    status: row.status,
    completedSteps: JSON.parse(row.completedStepsJson) as string[],
    spikeCompletedAt: toIso(row.spikeCompletedAt),
    challengeCompletedAt: toIso(row.challengeCompletedAt),
    noteId: row.noteId,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

async function findOwnedShred(
  db: Database,
  id: string,
  userId: string,
): Promise<SkillShredRow | undefined> {
  const [shred] = await db
    .select()
    .from(skillShreds)
    .where(and(eq(skillShreds.id, id), eq(skillShreds.userId, userId)))
    .limit(1);
  return shred;
}

const shredderRateLimit = rateLimit({ limit: 10, windowMs: 60_000 });

const generateHandler = async (
  c: Context<AppEnv, "/generate", JsonInput<SkillShredderInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  try {
    const { blueprint, usage } = await generateSkillShredder(
      c.env,
      input.topic,
      input.currentContext,
      input.targetTimeMinutes,
    );

    await db.insert(aiUsage).values({
      id: nanoid(),
      userId,
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      createdAt: new Date(),
    });

    return c.json({ blueprint });
  } catch (error) {
    if (error instanceof SkillShredderError) {
      return c.json({ error: error.message }, 502);
    }
    throw error;
  }
};

const createShredHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateSkillShredInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const shredId = nanoid();
  const now = new Date();

  await db.insert(skillShreds).values({
    id: shredId,
    userId,
    topic: input.topic,
    currentContext: input.currentContext ?? null,
    targetTimeMinutes: input.targetTimeMinutes,
    toyProjectTitle: input.blueprint.toyProjectTitle,
    blueprintJson: JSON.stringify(input.blueprint),
    status: "draft",
    completedStepsJson: "[]",
    createdAt: now,
    updatedAt: now,
  });

  const created = await findOwnedShred(db, shredId, userId);
  if (!created) {
    throw new Error("Failed to create skill shred");
  }
  return c.json({ shred: toSkillShredResponse(created) }, 201);
};

const listShredsHandler = async (c: Context<AppEnv, "/">) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(skillShreds)
    .where(eq(skillShreds.userId, userId))
    .orderBy(desc(skillShreds.createdAt));

  return c.json({ shreds: rows.map(toSkillShredResponse) });
};

const getShredHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const shred = await findOwnedShred(db, id, userId);
  if (!shred) {
    return c.json({ error: "Skill shred not found" }, 404);
  }

  return c.json({ shred: toSkillShredResponse(shred) });
};

const updateProgressHandler = async (
  c: Context<AppEnv, "/:id/progress", JsonInput<UpdateSkillProgressInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const shred = await findOwnedShred(db, id, userId);
  if (!shred) {
    return c.json({ error: "Skill shred not found" }, 404);
  }

  const updates: Partial<SkillShredRow> = { updatedAt: new Date() };

  if (input.completedSteps !== undefined) {
    const completed = [...new Set(input.completedSteps)];
    const blueprint = skillShredderResultSchema.parse(
      JSON.parse(shred.blueprintJson),
    );
    const derived = deriveSkillShredStatus(completed, blueprint);
    updates.completedStepsJson = JSON.stringify(completed);
    if (input.status === undefined) {
      updates.status = derived;
    }
    if (completed.includes(SPIKE_STEP_KEY) && !shred.spikeCompletedAt) {
      updates.spikeCompletedAt = new Date();
    }
    if (
      completed.includes(CHALLENGE_STEP_KEY) &&
      !shred.challengeCompletedAt
    ) {
      updates.challengeCompletedAt = new Date();
    }
  }

  if (input.status !== undefined) {
    updates.status = input.status;
  }

  await db
    .update(skillShreds)
    .set(updates)
    .where(and(eq(skillShreds.id, id), eq(skillShreds.userId, userId)));

  const updated = await findOwnedShred(db, id, userId);
  if (!updated) {
    throw new Error("Failed to update skill shred");
  }
  return c.json({ shred: toSkillShredResponse(updated) });
};

const exportToNoteHandler = async (c: Context<AppEnv, "/:id/note">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const shred = await findOwnedShred(db, id, userId);
  if (!shred) {
    return c.json({ error: "Skill shred not found" }, 404);
  }

  const blueprint = skillShredderResultSchema.parse(
    JSON.parse(shred.blueprintJson),
  );
  const noteId = nanoid();
  const now = new Date();
  const title = `TIL: ${blueprint.topicTitle}`.slice(0, 200);

  await db.insert(notes).values({
    id: noteId,
    userId,
    workspaceId: null,
    title,
    content: buildTilNoteContent(blueprint),
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(skillShreds)
    .set({ noteId, updatedAt: now })
    .where(and(eq(skillShreds.id, id), eq(skillShreds.userId, userId)));

  const updated = await findOwnedShred(db, id, userId);
  if (!updated) {
    throw new Error("Failed to link exported note");
  }
  return c.json({ noteId, shred: toSkillShredResponse(updated) }, 201);
};

const deleteShredHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const [deleted] = await db
    .delete(skillShreds)
    .where(and(eq(skillShreds.id, id), eq(skillShreds.userId, userId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Skill shred not found" }, 404);
  }

  return c.json({ success: true });
};

export const skillShredderRoute = new Hono<AppEnv>()
  .post(
    "/generate",
    shredderRateLimit,
    zValidator("json", skillShredderInputSchema),
    generateHandler,
  )
  .get("/", listShredsHandler)
  .post("/", zValidator("json", createSkillShredSchema), createShredHandler)
  .get("/:id", getShredHandler)
  .patch(
    "/:id/progress",
    zValidator("json", updateSkillProgressSchema),
    updateProgressHandler,
  )
  .post("/:id/note", exportToNoteHandler)
  .delete("/:id", deleteShredHandler);
