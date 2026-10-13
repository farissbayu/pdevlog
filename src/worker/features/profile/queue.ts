import { createDb } from "@/worker/db";

import {
  analyzeAndSaveSkillInsights,
  extractAndSaveCv,
  loadUser,
  markProfile,
} from "./service";

export type AiJobMessage =
  | { kind: "cv"; userId: string; key: string; name: string; type: string }
  | { kind: "skills"; userId: string };

async function runAiJob(env: Env, message: AiJobMessage): Promise<void> {
  const db = createDb(env.DB);
  const user = await loadUser(db, message.userId);
  if (!user) {
    return;
  }

  if (message.kind === "skills") {
    await analyzeAndSaveSkillInsights(db, env, message.userId);
    return;
  }

  const object = await env.STORAGE.get(message.key);
  if (!object) {
    throw new Error("CV upload not found");
  }
  try {
    const file = new File([await object.arrayBuffer()], message.name, {
      type: message.type,
    });
    await extractAndSaveCv(db, env, user, file);
  } finally {
    await env.STORAGE.delete(message.key);
  }
}

async function markJobFailed(env: Env, message: AiJobMessage): Promise<void> {
  const db = createDb(env.DB);
  if (message.kind === "skills") {
    await markProfile(db, message.userId, { insightsStatus: "failed" });
  } else {
    await markProfile(db, message.userId, { cvParseStatus: "failed" });
  }
}

export async function handleAiJobBatch(
  batch: MessageBatch<AiJobMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await runAiJob(env, message.body);
    } catch (error) {
      console.error("AI job failed:", error);
      await markJobFailed(env, message.body);
    }
  }
}
