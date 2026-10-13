import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";

import {
  updateProfileRequestSchema,
  type UpdateProfileRequest,
} from "@/shared/schemas/profile";
import { createDb, type Database } from "@/worker/db";
import { userProfiles, users, type UserRow } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { rateLimit } from "@/worker/middleware/rate-limit";

import {
  analyzeAndSaveSkillInsights,
  extractAndSaveCv,
  extractPersonaFromCv,
  getOrCreateProfile,
  updateProfile,
} from "./service";

type JsonInput<T> = { in: { json: T }; out: { json: T } };

async function loadUser(db: Database, userId: string): Promise<UserRow | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

// Background AI jobs run in waitUntil(), which Workers cancel ~30s after the
// response. If that happens the status never leaves "processing"/"analyzing",
// so the client polls forever; fail stale jobs on read to unstick it.
const STALE_JOB_MS = 120_000;

const getProfileHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await loadUser(db, userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const profile = await getOrCreateProfile(db, user);

  const stale =
    Date.now() - new Date(profile.updatedAt).getTime() > STALE_JOB_MS;
  if (
    stale &&
    (profile.cvParseStatus === "processing" ||
      profile.cvAuditStatus === "auditing" ||
      profile.insightsStatus === "analyzing")
  ) {
    const patch: Partial<typeof userProfiles.$inferInsert> = {
      ...(profile.cvParseStatus === "processing"
        ? { cvParseStatus: "failed" }
        : {}),
      ...(profile.cvAuditStatus === "auditing"
        ? { cvAuditStatus: "failed" }
        : {}),
      ...(profile.insightsStatus === "analyzing"
        ? { insightsStatus: "failed" }
        : {}),
    };
    await markProfile(db, userId, patch);
    return c.json({
      ...profile,
      cvParseStatus: patch.cvParseStatus ?? profile.cvParseStatus,
      cvAuditStatus: patch.cvAuditStatus ?? profile.cvAuditStatus,
      insightsStatus: patch.insightsStatus ?? profile.insightsStatus,
    });
  }

  return c.json(profile);
};

const updateProfileHandler = async (
  c: Context<AppEnv, "/", JsonInput<UpdateProfileRequest>>,
) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await loadUser(db, userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const input = c.req.valid("json");
  const profile = await updateProfile(db, user, input);
  return c.json(profile);
};

async function markProfile(
  db: Database,
  userId: string,
  values: Partial<typeof userProfiles.$inferInsert>,
): Promise<void> {
  await db
    .update(userProfiles)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId));
}

const uploadCvHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await loadUser(db, userId);

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

  await getOrCreateProfile(db, user);
  await markProfile(db, userId, { cvParseStatus: "processing" });

  c.executionCtx.waitUntil(
    (async () => {
      try {
        await extractAndSaveCv(db, c.env, user, file);
      } catch (error) {
        console.error("POST /api/profile/cv/upload background error:", error);
        await markProfile(db, userId, { cvParseStatus: "failed" });
      }
    })(),
  );

  return c.json({ status: "processing" }, 202);
};

const analyzeSkillsHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await loadUser(db, userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  await getOrCreateProfile(db, user);
  await markProfile(db, userId, { insightsStatus: "analyzing" });

  c.executionCtx.waitUntil(
    (async () => {
      try {
        await analyzeAndSaveSkillInsights(db, c.env, userId);
      } catch (error) {
        console.error(
          "POST /api/profile/skills/analyze background error:",
          error,
        );
        await markProfile(db, userId, { insightsStatus: "failed" });
      }
    })(),
  );

  return c.json({ status: "analyzing" }, 202);
};

const extractPersonaHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await loadUser(db, userId);

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

const aiRateLimit = rateLimit({ limit: 10, windowMs: 60_000 });

export const profileRoute = new Hono<AppEnv>()
  .get("/", getProfileHandler)
  .patch("/", zValidator("json", updateProfileRequestSchema), updateProfileHandler)
  .post("/cv/upload", aiRateLimit, uploadCvHandler)
  .post("/skills/analyze", aiRateLimit, analyzeSkillsHandler)
  .post("/persona/extract", aiRateLimit, extractPersonaHandler);
