import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";

import {
  updateProfileRequestSchema,
  type UpdateProfileRequest,
} from "@/shared/schemas/profile";
import { createDb } from "@/worker/db";
import { users } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { syncCvGrowth } from "@/worker/features/skills/service";

import {
  analyzeAndSaveSkillInsights,
  extractAndSaveCv,
  extractPersonaFromCv,
  getOrCreateProfile,
  updateProfile,
} from "./service";

type JsonInput<T> = { in: { json: T }; out: { json: T } };

const getProfileHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const profile = await getOrCreateProfile(db, user);
  return c.json(profile);
};

const updateProfileHandler = async (
  c: Context<AppEnv, "/", JsonInput<UpdateProfileRequest>>,
) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const input = c.req.valid("json");
  const profile = await updateProfile(db, user, input);
  return c.json(profile);
};

const uploadCvHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string" || !(file instanceof File)) {
    return c.json(
      { error: "A valid PDF, Markdown, or text file is required." },
      400,
    );
  }

  try {
    const result = await extractAndSaveCv(db, c.env, user, file);
    return c.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract CV file.";
    return c.json({ error: message }, 400);
  }
};

const syncCvSkillsHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  try {
    const result = await syncCvGrowth(db, c.env, userId);
    return c.json(result);
  } catch (error) {
    console.error("POST /api/profile/cv/sync-skills error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to sync skill mastery from CV.";
    return c.json({ error: message }, 500);
  }
};

const analyzeSkillsHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  try {
    const result = await analyzeAndSaveSkillInsights(db, c.env, userId);
    return c.json(result);
  } catch (error) {
    console.error("POST /api/profile/skills/analyze error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to analyze engineering skills.";
    return c.json({ error: message }, 500);
  }
};

const extractPersonaHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  try {
    const profile = await extractPersonaFromCv(db, c.env, user);
    return c.json(profile);
  } catch (error) {
    console.error("POST /api/profile/persona/extract error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to extract persona details from CV.";
    return c.json({ error: message }, 400);
  }
};

export const profileRoute = new Hono<AppEnv>()
  .get("/", getProfileHandler)
  .patch("/", zValidator("json", updateProfileRequestSchema), updateProfileHandler)
  .post("/cv/upload", uploadCvHandler)
  .post("/cv/sync-skills", syncCvSkillsHandler)
  .post("/skills/analyze", analyzeSkillsHandler)
  .post("/persona/extract", extractPersonaHandler);

