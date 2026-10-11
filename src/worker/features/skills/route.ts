import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";

import {
  attachEvidenceInputSchema,
  type AttachEvidenceInput,
} from "@/shared/schemas/skills";
import { createDb } from "@/worker/db";
import type { AppEnv } from "@/worker/env";
import {
  attachEvidenceManual,
  getSkillsWithRadar,
  syncAllUserGrowth,
  unlinkEvidence,
} from "./service";

type JsonInput<T> = { in: { json: T }; out: { json: T } };

const getSkillsHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const result = await getSkillsWithRadar(db, userId);
  return c.json(result);
};

const getRadarHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const result = await getSkillsWithRadar(db, userId);
  return c.json({ radar: result.radar });
};

const syncGrowthHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const result = await syncAllUserGrowth(db, c.env, userId);
  return c.json(result);
};

const attachEvidenceHandler = async (
  c: Context<
    AppEnv,
    "/milestones/:milestoneId/evidence",
    JsonInput<AttachEvidenceInput>
  >,
) => {
  const userId = c.get("userId");
  const milestoneId = c.req.param("milestoneId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const evidence = await attachEvidenceManual(db, userId, milestoneId, input);
  return c.json({ evidence }, 201);
};

const unlinkEvidenceHandler = async (
  c: Context<AppEnv, "/evidence/:evidenceId">,
) => {
  const userId = c.get("userId");
  const evidenceId = c.req.param("evidenceId");
  const db = createDb(c.env.DB);

  const result = await unlinkEvidence(db, userId, evidenceId);
  if (!result.success) {
    return c.json({ error: "Evidence not found or unauthorized" }, 404);
  }
  return c.json({ success: true });
};

export const skillsRoute = new Hono<AppEnv>()
  .get("/", getSkillsHandler)
  .get("/radar", getRadarHandler)
  .post("/sync", syncGrowthHandler)
  .post(
    "/milestones/:milestoneId/evidence",
    zValidator("json", attachEvidenceInputSchema),
    attachEvidenceHandler,
  )
  .delete("/evidence/:evidenceId", unlinkEvidenceHandler);

