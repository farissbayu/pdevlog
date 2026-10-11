import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  CHALLENGE_STEP_KEY,
  SPIKE_STEP_KEY,
  buildTilNoteContent,
  createSkillShredSchema,
  deriveSkillShredStatus,
  exportSkillNoteQuerySchema,
  listSkillShredsQuerySchema,
  skillShredderResultSchema,
  updateSkillProgressSchema,
  type CreateSkillShredInput,
  type ExportSkillNoteQuery,
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
import { generateSkillShredder } from "@/worker/lib/ai-client";
import { rateLimit } from "@/worker/middleware/rate-limit";

type JsonInput<T> = { in: { json: T }; out: { json: T } };
type QueryInput<T> = { in: { query: T }; out: { query: T } };

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
    blueprint: row.blueprintJson
      ? (JSON.parse(row.blueprintJson) as SkillShredderResult)
      : null,
    status: row.status,
    errorMessage: row.errorMessage,
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

async function runShredGeneration(
  c: Context<AppEnv>,
  db: Database,
  userId: string,
  shredId: string,
): Promise<void> {
  const [shred] = await db
    .select()
    .from(skillShreds)
    .where(and(eq(skillShreds.id, shredId), eq(skillShreds.userId, userId)))
    .limit(1);
  if (!shred) {
    return;
  }

  try {
    const { blueprint, usage } = await generateSkillShredder(
      c.env,
      shred.topic,
      shred.currentContext ?? undefined,
      shred.targetTimeMinutes,
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

    await db
      .update(skillShreds)
      .set({
        toyProjectTitle: blueprint.toyProjectTitle,
        blueprintJson: JSON.stringify(blueprint),
        status: "draft",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(and(eq(skillShreds.id, shredId), eq(skillShreds.userId, userId)));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI generation failed";
    await db
      .update(skillShreds)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(and(eq(skillShreds.id, shredId), eq(skillShreds.userId, userId)));
  }
}

function scheduleShredGeneration(
  c: Context<AppEnv>,
  db: Database,
  userId: string,
  shredId: string,
): void {
  c.executionCtx.waitUntil(
    runShredGeneration(c, db, userId, shredId).catch((error) => {
      console.error("Skill shred background generation failed:", error);
    }),
  );
}

const createShredHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateSkillShredInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  if (input.noteId) {
    const [ownedNote] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, input.noteId), eq(notes.userId, userId)))
      .limit(1);
    if (!ownedNote) {
      return c.json({ error: "Source note not found" }, 404);
    }
  }

  const shredId = nanoid();
  const now = new Date();

  await db.insert(skillShreds).values({
    id: shredId,
    userId,
    topic: input.topic,
    currentContext: input.currentContext ?? null,
    targetTimeMinutes: input.targetTimeMinutes,
    status: "generating",
    completedStepsJson: "[]",
    noteId: input.noteId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  scheduleShredGeneration(c, db, userId, shredId);

  const created = await findOwnedShred(db, shredId, userId);
  if (!created) {
    throw new Error("Failed to create skill shred");
  }
  return c.json({ shred: toSkillShredResponse(created) }, 202);
};

const retryShredHandler = async (c: Context<AppEnv, "/:id/retry">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const shred = await findOwnedShred(db, id, userId);
  if (!shred) {
    return c.json({ error: "Skill shred not found" }, 404);
  }
  if (shred.status !== "failed") {
    return c.json({ error: "Only failed shreds can be retried" }, 409);
  }

  await db
    .update(skillShreds)
    .set({ status: "generating", errorMessage: null, updatedAt: new Date() })
    .where(and(eq(skillShreds.id, id), eq(skillShreds.userId, userId)));

  scheduleShredGeneration(c, db, userId, id);

  const updated = await findOwnedShred(db, id, userId);
  if (!updated) {
    throw new Error("Failed to retry skill shred");
  }
  return c.json({ shred: toSkillShredResponse(updated) }, 202);
};

const listShredsHandler = async (c: Context<AppEnv, "/">) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const noteId = c.req.query("note_id");
  const conditions: SQL[] = [eq(skillShreds.userId, userId)];
  if (noteId) {
    conditions.push(eq(skillShreds.noteId, noteId));
  }

  const rows = await db
    .select()
    .from(skillShreds)
    .where(and(...conditions))
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
    if (!shred.blueprintJson) {
      return c.json({ error: "Blueprint is not ready yet" }, 409);
    }
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

const exportToNoteHandler = async (
  c: Context<AppEnv, "/:id/note", QueryInput<ExportSkillNoteQuery>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const shred = await findOwnedShred(db, id, userId);
  if (!shred) {
    return c.json({ error: "Skill shred not found" }, 404);
  }
  if (!shred.blueprintJson) {
    return c.json({ error: "Blueprint is not ready yet" }, 409);
  }

  const blueprint = skillShredderResultSchema.parse(
    JSON.parse(shred.blueprintJson),
  );
  const now = new Date();
  const mode = c.req.query("mode") === "append" ? "append" : "new";

  if (mode === "append" && shred.noteId) {
    const [ownedNote] = await db
      .select({ id: notes.id, content: notes.content })
      .from(notes)
      .where(and(eq(notes.id, shred.noteId), eq(notes.userId, userId)))
      .limit(1);
    if (ownedNote) {
      await db
        .update(notes)
        .set({
          content: `${ownedNote.content}\n\n## Hands-on Implementation (Toy Project)\n\n${buildTilNoteContent(blueprint)}`,
          updatedAt: now,
        })
        .where(and(eq(notes.id, ownedNote.id), eq(notes.userId, userId)));

      const updated = await findOwnedShred(db, id, userId);
      if (!updated) {
        throw new Error("Failed to append to source note");
      }
      return c.json(
        { noteId: ownedNote.id, shred: toSkillShredResponse(updated) },
        201,
      );
    }
  }

  const noteId = nanoid();
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
  .get("/", zValidator("query", listSkillShredsQuerySchema), listShredsHandler)
  .post(
    "/",
    shredderRateLimit,
    zValidator("json", createSkillShredSchema),
    createShredHandler,
  )
  .get("/:id", getShredHandler)
  .post("/:id/retry", retryShredHandler)
  .patch(
    "/:id/progress",
    zValidator("json", updateSkillProgressSchema),
    updateProgressHandler,
  )
  .post(
    "/:id/note",
    zValidator("query", exportSkillNoteQuerySchema),
    exportToNoteHandler,
  )
  .delete("/:id", deleteShredHandler);
