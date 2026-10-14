import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  updateProfileRequestSchema,
  type UpdateProfileRequest,
} from "@/shared/schemas/profile";
import { createDb } from "@/worker/db";
import { userProfiles } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { rateLimit } from "@/worker/middleware/rate-limit";

import {
  extractPersonaFromCv,
  generateCaseStudyForGap,
  getOrCreateProfile,
  loadUser,
  markProfile,
  updateProfile,
} from "./service";

type JsonInput<T> = { in: { json: T }; out: { json: T } };

// Safety net: if a queued AI job never finishes (consumer crash, poisoned
// message), the status would stay "processing"/"analyzing" and the client would
// poll forever. Fail anything older than this on read so it unsticks itself.
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

  const key = `cv-uploads/${userId}/${nanoid()}`;
  await c.env.STORAGE.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await getOrCreateProfile(db, user);
  await markProfile(db, userId, { cvParseStatus: "processing" });
  await c.env.AI_QUEUE.send({
    kind: "cv",
    userId,
    key,
    name: file.name,
    type: file.type,
  });

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
  await c.env.AI_QUEUE.send({ kind: "skills", userId });

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

const caseStudyHandler = async (
  c: Context<AppEnv, "/growth-areas/:id/case-study">,
) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await loadUser(db, userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  try {
    const brief = await generateCaseStudyForGap(
      db,
      c.env,
      userId,
      c.req.param("id"),
    );
    if (!brief) {
      return c.json({ error: "Growth area not found" }, 404);
    }
    return c.json({ brief });
  } catch (error) {
    console.error("POST /api/profile/growth-areas/:id/case-study error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate a case study.";
    return c.json({ error: message }, 400);
  }
};

export const profileRoute = new Hono<AppEnv>()
  .get("/", getProfileHandler)
  .patch("/", zValidator("json", updateProfileRequestSchema), updateProfileHandler)
  .post("/cv/upload", aiRateLimit, uploadCvHandler)
  .post("/skills/analyze", aiRateLimit, analyzeSkillsHandler)
  .post("/persona/extract", aiRateLimit, extractPersonaHandler)
  .post("/growth-areas/:id/case-study", aiRateLimit, caseStudyHandler);
