import { and, count, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  CANONICAL_SKILL_SEEDS,
  type AttachEvidenceInput,
  type MilestoneEvidenceResponse,
  type RadarAxis,
  type RadarSummary,
  type SkillDetailResponse,
  type SkillMilestoneResponse,
  type SkillsListResponse,
} from "@/shared/schemas/skills";
import type { SyncCvSkillsResponse } from "@/shared/schemas/profile";
import type { Database } from "@/worker/db";
import {
  aiUsage,
  bragLogs,
  milestoneEvidences,
  notes,
  projectItems,
  skillMilestones,
  skillShreds,
  skills,
  userProfiles,
  type MilestoneEvidenceRow,
} from "@/worker/db/schema";

import type { AppEnv } from "@/worker/env";
import { auditCvSkillEvidence, auditSkillEvidence } from "@/worker/lib/ai-client";

export async function ensureUserSkills(
  db: Database,
  userId: string,
): Promise<void> {
  const existing = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    // Check if user has legacy system-engineer seeds (database-internals)
    const hasLegacySeed = await db
      .select({ id: skills.id })
      .from(skills)
      .where(
        and(eq(skills.userId, userId), eq(skills.slug, "database-internals")),
      )
      .limit(1);

    if (hasLegacySeed.length > 0) {
      const [evidenceCount] = await db
        .select({ value: count() })
        .from(milestoneEvidences)
        .where(eq(milestoneEvidences.userId, userId));

      // If no evidence attached yet, automatically upgrade to Product Engineer seeds
      if ((evidenceCount?.value ?? 0) === 0) {
        await db.delete(skills).where(eq(skills.userId, userId));
      } else {
        return;
      }
    } else {
      return;
    }
  }


  const now = new Date();
  for (const seed of CANONICAL_SKILL_SEEDS) {
    const skillId = nanoid();
    await db.insert(skills).values({
      id: skillId,
      userId,
      name: seed.name,
      slug: seed.slug,
      description: seed.description,
      position: seed.position,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < seed.milestones.length; i++) {
      const m = seed.milestones[i];
      await db.insert(skillMilestones).values({
        id: nanoid(),
        userId,
        skillId,
        level: m.level,
        title: m.title,
        criteria: m.criteria,
        status: "locked",
        position: i,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

type EvidenceEntityMap = {
  bragLogs: Map<string, string>;
  notes: Map<string, string>;
  skillShreds: Map<string, string>;
  projectItems: Map<string, string>;
};

async function loadEvidenceEntities(
  db: Database,
  userId: string,
  evidenceRows: MilestoneEvidenceRow[],
): Promise<EvidenceEntityMap> {
  const bragIds = evidenceRows
    .filter((r) => r.evidenceType === "brag_log")
    .map((r) => r.evidenceId);
  const noteIds = evidenceRows
    .filter((r) => r.evidenceType === "note")
    .map((r) => r.evidenceId);
  const shredIds = evidenceRows
    .filter((r) => r.evidenceType === "skill_shred")
    .map((r) => r.evidenceId);
  const itemIds = evidenceRows
    .filter((r) => r.evidenceType === "project_item")
    .map((r) => r.evidenceId);

  const [bragRows, noteRows, shredRows, itemRows] = await Promise.all([
    bragIds.length > 0
      ? db
          .select({ id: bragLogs.id, title: bragLogs.title })
          .from(bragLogs)
          .where(and(eq(bragLogs.userId, userId), inArray(bragLogs.id, bragIds)))
      : [],
    noteIds.length > 0
      ? db
          .select({ id: notes.id, title: notes.title })
          .from(notes)
          .where(and(eq(notes.userId, userId), inArray(notes.id, noteIds)))
      : [],
    shredIds.length > 0
      ? db
          .select({ id: skillShreds.id, title: skillShreds.toyProjectTitle })
          .from(skillShreds)
          .where(
            and(
              eq(skillShreds.userId, userId),
              inArray(skillShreds.id, shredIds),
            ),
          )
      : [],
    itemIds.length > 0
      ? db
          .select({ id: projectItems.id, title: projectItems.title })
          .from(projectItems)
          .where(
            and(
              eq(projectItems.userId, userId),
              inArray(projectItems.id, itemIds),
            ),
          )
      : [],
  ]);

  return {
    bragLogs: new Map(bragRows.map((r): [string, string] => [r.id, r.title])),
    notes: new Map(noteRows.map((r): [string, string] => [r.id, r.title])),
    skillShreds: new Map(shredRows.map((r): [string, string] => [r.id, r.title])),
    projectItems: new Map(itemRows.map((r): [string, string] => [r.id, r.title])),
  };

}

function resolveEvidenceUrl(type: string, id: string): string {
  switch (type) {
    case "brag_log":
      return `/brag-logs/${id}`;
    case "note":
      return `/notes/${id}`;
    case "skill_shred":
      return `/skill-shredder/${id}`;
    case "project_item":
      return `/workspaces`;
    case "cv":
      return `/profile`;
    default:
      return "#";
  }
}

export async function getSkillsWithRadar(
  db: Database,
  userId: string,
): Promise<SkillsListResponse> {
  await ensureUserSkills(db, userId);

  const [allSkills, allMilestones, allEvidences] = await Promise.all([
    db
      .select()
      .from(skills)
      .where(eq(skills.userId, userId))
      .orderBy(skills.position),
    db
      .select()
      .from(skillMilestones)
      .where(eq(skillMilestones.userId, userId))
      .orderBy(skillMilestones.level, skillMilestones.position),
    db
      .select()
      .from(milestoneEvidences)
      .where(eq(milestoneEvidences.userId, userId))
      .orderBy(desc(milestoneEvidences.createdAt)),
  ]);

  const entityMap = await loadEvidenceEntities(db, userId, allEvidences);

  const evidencesByMilestone = new Map<string, MilestoneEvidenceResponse[]>();
  for (const row of allEvidences) {
    let title = "Evidence Item";
    if (row.evidenceType === "brag_log") {
      title = entityMap.bragLogs.get(row.evidenceId) ?? "Brag Log";
    } else if (row.evidenceType === "note") {
      title = entityMap.notes.get(row.evidenceId) ?? "Note";
    } else if (row.evidenceType === "skill_shred") {
      title = entityMap.skillShreds.get(row.evidenceId) ?? "Toy Project";
    } else if (row.evidenceType === "project_item") {
      title = entityMap.projectItems.get(row.evidenceId) ?? "Project Item";
    } else if (row.evidenceType === "cv") {
      title = "Resume / CV Baseline";
    }

    const item: MilestoneEvidenceResponse = {
      id: row.id,
      milestoneId: row.milestoneId,
      evidenceType: row.evidenceType,
      evidenceId: row.evidenceId,
      title,
      url: resolveEvidenceUrl(row.evidenceType, row.evidenceId),
      reflection: row.reflection,
      confidence: row.confidence,
      autoDetected: Boolean(row.autoDetected),
      createdAt: new Date(row.createdAt).toISOString(),
    };

    const list = evidencesByMilestone.get(row.milestoneId) ?? [];
    list.push(item);
    evidencesByMilestone.set(row.milestoneId, list);
  }

  const milestonesBySkill = new Map<string, SkillMilestoneResponse[]>();
  for (const m of allMilestones) {
    const evidences = evidencesByMilestone.get(m.id) ?? [];
    const status = evidences.length > 0 ? "achieved" : m.status;

    const res: SkillMilestoneResponse = {
      id: m.id,
      skillId: m.skillId,
      level: m.level,
      title: m.title,
      criteria: m.criteria,
      status,
      achievedAt: m.achievedAt ? new Date(m.achievedAt).toISOString() : null,
      position: m.position,
      evidences,
    };

    const list = milestonesBySkill.get(m.skillId) ?? [];
    list.push(res);
    milestonesBySkill.set(m.skillId, list);
  }

  const skillDetails: SkillDetailResponse[] = [];
  const axes: RadarAxis[] = [];
  let totalAchievedCount = 0;
  let totalEvidenceCount = 0;

  for (const s of allSkills) {
    const milestones = milestonesBySkill.get(s.id) ?? [];
    const achieved = milestones.filter((m) => m.status === "achieved");
    const achievedLevels = achieved.map((m) => m.level);
    const maxAchievedLevel =
      achievedLevels.length > 0 ? Math.max(...achievedLevels) : 0;

    let totalSkillEvidences = 0;
    for (const m of milestones) {
      totalSkillEvidences += m.evidences.length;
    }

    const bonusDepth = Math.min(0.9, totalSkillEvidences * 0.15);
    const score = Number(
      Math.min(5, maxAchievedLevel + bonusDepth).toFixed(2),
    );

    totalAchievedCount += achieved.length;
    totalEvidenceCount += totalSkillEvidences;

    skillDetails.push({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      position: s.position,
      score,
      currentLevel: maxAchievedLevel,
      milestones,
    });

    axes.push({
      skillId: s.id,
      name: s.name,
      slug: s.slug,
      score,
      level: maxAchievedLevel,
      targetLevel: 5,
      milestonesCount: milestones.length,
      achievedCount: achieved.length,
      evidencesCount: totalSkillEvidences,
    });
  }

  const overallLevel =
    axes.length > 0
      ? Number(
          (
            axes.reduce((sum, a) => sum + a.score, 0) / axes.length
          ).toFixed(2),
        )
      : 0;

  const radar: RadarSummary = {
    axes,
    overallLevel,
    totalAchievedMilestones: totalAchievedCount,
    totalEvidences: totalEvidenceCount,
  };

  return {
    skills: skillDetails,
    radar,
  };
}

export async function unlinkEvidence(
  db: Database,
  userId: string,
  evidenceId: string,
): Promise<{ success: boolean }> {
  const [evidence] = await db
    .select()
    .from(milestoneEvidences)
    .where(
      and(
        eq(milestoneEvidences.id, evidenceId),
        eq(milestoneEvidences.userId, userId),
      ),
    )
    .limit(1);

  if (!evidence) {
    return { success: false };
  }

  await db
    .delete(milestoneEvidences)
    .where(eq(milestoneEvidences.id, evidenceId));

  // Check if milestone still has any remaining evidence
  const remaining = await db
    .select({ id: milestoneEvidences.id })
    .from(milestoneEvidences)
    .where(eq(milestoneEvidences.milestoneId, evidence.milestoneId))
    .limit(1);

  if (remaining.length === 0) {
    await db
      .update(skillMilestones)
      .set({ status: "locked", achievedAt: null, updatedAt: new Date() })
      .where(eq(skillMilestones.id, evidence.milestoneId));
  }

  return { success: true };
}

export async function attachEvidenceManual(
  db: Database,
  userId: string,
  milestoneId: string,
  input: AttachEvidenceInput,
): Promise<MilestoneEvidenceResponse> {
  const now = new Date();
  const id = nanoid();

  await db.insert(milestoneEvidences).values({
    id,
    userId,
    milestoneId,
    evidenceType: input.evidenceType,
    evidenceId: input.evidenceId,
    reflection: input.reflection ?? null,
    confidence: 100,
    autoDetected: 0,
    createdAt: now,
  });

  await db
    .update(skillMilestones)
    .set({ status: "achieved", achievedAt: now, updatedAt: now })
    .where(eq(skillMilestones.id, milestoneId));

  return {
    id,
    milestoneId,
    evidenceType: input.evidenceType,
    evidenceId: input.evidenceId,
    title: "Attached Evidence",
    url: resolveEvidenceUrl(input.evidenceType, input.evidenceId),
    reflection: input.reflection ?? null,
    confidence: 100,
    autoDetected: false,
    createdAt: now.toISOString(),
  };
}

export async function auditAndLinkEvidence(params: {
  db: Database;
  env: AppEnv["Bindings"];
  userId: string;
  evidenceType: "brag_log" | "note" | "skill_shred" | "project_item";
  evidenceId: string;
  title: string;
  content: string;
  tags?: string[];
}): Promise<boolean> {
  const { db, env, userId, evidenceType, evidenceId, title, content, tags } =
    params;

  if (!env.AI_API_KEY) {
    return false;
  }

  await ensureUserSkills(db, userId);

  try {
    const { audit, usage } = await auditSkillEvidence(env, {
      title,
      content,
      tags,
    });

    await db.insert(aiUsage).values({
      id: nanoid(),
      userId,
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      createdAt: new Date(),
    });

    if (audit.matchedSkillSlug === "none" || audit.confidenceScore < 0.6) {
      return false;
    }

    const [matchedSkill] = await db
      .select()
      .from(skills)
      .where(
        and(eq(skills.userId, userId), eq(skills.slug, audit.matchedSkillSlug)),
      )
      .limit(1);

    if (!matchedSkill) {
      return false;
    }

    const targetLevel = audit.inferredLevel ?? 2;
    const skillMilestoneList = await db
      .select()
      .from(skillMilestones)
      .where(
        and(
          eq(skillMilestones.userId, userId),
          eq(skillMilestones.skillId, matchedSkill.id),
        ),
      );

    const targetMilestone =
      skillMilestoneList.find((m) => m.level === targetLevel) ??
      skillMilestoneList[0];

    if (!targetMilestone) {
      return false;
    }

    // Check if already linked
    const existing = await db
      .select({ id: milestoneEvidences.id })
      .from(milestoneEvidences)
      .where(
        and(
          eq(milestoneEvidences.userId, userId),
          eq(milestoneEvidences.milestoneId, targetMilestone.id),
          eq(milestoneEvidences.evidenceType, evidenceType),
          eq(milestoneEvidences.evidenceId, evidenceId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return true;
    }

    const now = new Date();
    await db.insert(milestoneEvidences).values({
      id: nanoid(),
      userId,
      milestoneId: targetMilestone.id,
      evidenceType,
      evidenceId,
      reflection: audit.reasoningSnippet,
      confidence: Math.round(audit.confidenceScore * 100),
      autoDetected: 1,
      createdAt: now,
    });

    await db
      .update(skillMilestones)
      .set({
        status: "achieved",
        achievedAt: now,
        updatedAt: now,
      })
      .where(eq(skillMilestones.id, targetMilestone.id));

    return true;
  } catch (error) {
    console.error("auditAndLinkEvidence error:", error);
    return false;
  }
}

export async function syncAllUserGrowth(
  db: Database,
  env: AppEnv["Bindings"],
  userId: string,
): Promise<SkillsListResponse> {
  await ensureUserSkills(db, userId);

  if (!env.AI_API_KEY) {
    return getSkillsWithRadar(db, userId);
  }

  // Load recent brag logs and notes
  const [recentLogs, recentNotes] = await Promise.all([
    db
      .select()
      .from(bragLogs)
      .where(eq(bragLogs.userId, userId))
      .orderBy(desc(bragLogs.createdAt))
      .limit(10),
    db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.createdAt))
      .limit(10),
  ]);

  for (const log of recentLogs) {
    await auditAndLinkEvidence({
      db,
      env,
      userId,
      evidenceType: "brag_log",
      evidenceId: log.id,
      title: log.title,
      content: `Situation: ${log.situation}\nTask: ${log.task}\nAction: ${log.action}\nResult: ${log.result}`,
    });
  }

  for (const note of recentNotes) {
    if (note.content.length > 100) {
      await auditAndLinkEvidence({
        db,
        env,
        userId,
        evidenceType: "note",
        evidenceId: note.id,
        title: note.title,
        content: note.content.slice(0, 4000),
      });
    }
  }

  return getSkillsWithRadar(db, userId);
}

export async function syncCvGrowth(
  db: Database,
  env: AppEnv["Bindings"],
  userId: string,
): Promise<SyncCvSkillsResponse> {
  await ensureUserSkills(db, userId);

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (
    !profile ||
    !profile.cvMarkdown ||
    profile.cvMarkdown.trim().length === 0
  ) {
    return {
      matchedMilestonesCount: 0,
      newlyAchievedCount: 0,
      unlockedMilestones: [],
      message: "No CV markdown found. Please upload or paste your CV first.",
    };
  }

  if (!env.AI_API_KEY) {
    return {
      matchedMilestonesCount: 0,
      newlyAchievedCount: 0,
      unlockedMilestones: [],
      message: "AI service is not configured (missing AI_API_KEY).",
    };
  }

  const { result } = await auditCvSkillEvidence(env, profile.cvMarkdown);

  const userSkills = await db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId));
  const skillBySlug = new Map(userSkills.map((s) => [s.slug, s]));

  const userMilestones = await db
    .select()
    .from(skillMilestones)
    .where(eq(skillMilestones.userId, userId));

  const existingEvidences = await db
    .select()
    .from(milestoneEvidences)
    .where(eq(milestoneEvidences.userId, userId));

  const cvEvidenceByMilestone = new Map<
    string,
    typeof milestoneEvidences.$inferSelect
  >();
  for (const ev of existingEvidences) {
    if (ev.evidenceType === "cv") {
      cvEvidenceByMilestone.set(ev.milestoneId, ev);
    }
  }

  let newlyAchievedCount = 0;
  const unlockedMilestones: SyncCvSkillsResponse["unlockedMilestones"] = [];

  for (const match of result.matches) {
    const skill = skillBySlug.get(match.pillarSlug);
    if (!skill) continue;

    const milestone = userMilestones.find(
      (m) => m.skillId === skill.id && m.level === match.level,
    );
    if (!milestone) continue;

    const existingCvEvidence = cvEvidenceByMilestone.get(milestone.id);
    const reflectionText = `${match.quoteSnippet}\n\n${match.reasoning}`;
    const confidencePct = Math.round(match.confidenceScore * 100);

    if (existingCvEvidence) {
      await db
        .update(milestoneEvidences)
        .set({
          reflection: reflectionText,
          confidence: confidencePct,
        })
        .where(eq(milestoneEvidences.id, existingCvEvidence.id));
    } else {
      await db.insert(milestoneEvidences).values({
        id: nanoid(),
        userId,
        milestoneId: milestone.id,
        evidenceType: "cv",
        evidenceId: userId,
        reflection: reflectionText,
        confidence: confidencePct,
        autoDetected: 1,
      });

      if (milestone.status !== "achieved") {
        await db
          .update(skillMilestones)
          .set({
            status: "achieved",
            achievedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(skillMilestones.id, milestone.id));
        newlyAchievedCount++;
      }

      unlockedMilestones.push({
        milestoneId: milestone.id,
        title: milestone.title,
        pillarSlug: match.pillarSlug,
        level: match.level,
        quoteSnippet: match.quoteSnippet,
        aiReasoning: match.reasoning,
      });
    }
  }

  return {
    matchedMilestonesCount: result.matches.length,
    newlyAchievedCount,
    unlockedMilestones,
    message: `Successfully analyzed CV and mapped ${result.matches.length} milestones (${newlyAchievedCount} newly achieved).`,
  };
}

