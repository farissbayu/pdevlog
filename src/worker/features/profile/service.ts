import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { extractText } from "unpdf";

import {
  skillInsightsSchema,
  type AnalyzeSkillsResponse,
  type CvUploadResponse,
  type SkillInsights,
  type UpdateProfileRequest,
  type UserProfileResponse,
} from "@/shared/schemas/profile";
import type { Database } from "@/worker/db";
import {
  aiUsage,
  bragLogs,
  notes,
  userProfiles,
  type UserProfileRow,
  type UserRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import {
  analyzeDeveloperCompetencies,
  extractAndFormatResume,
} from "@/worker/lib/ai-client";

function parseStack(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function parseSkillInsights(
  raw: string | null | undefined,
): SkillInsights | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = skillInsightsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function toProfileResponse(
  user: UserRow,
  profile: UserProfileRow,
): UserProfileResponse {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    headline: profile.headline,
    bio: profile.bio,
    primaryStack: parseStack(profile.primaryStack),
    cvMarkdown: profile.cvMarkdown,
    cvExtractedAt: profile.cvExtractedAt
      ? new Date(profile.cvExtractedAt).toISOString()
      : null,
    skillInsights: parseSkillInsights(profile.skillInsights),
    skillAnalyzedAt: profile.skillAnalyzedAt
      ? new Date(profile.skillAnalyzedAt).toISOString()
      : null,
    createdAt: new Date(profile.createdAt).toISOString(),
    updatedAt: new Date(profile.updatedAt).toISOString(),
  };
}

export async function getOrCreateProfile(
  db: Database,
  user: UserRow,
): Promise<UserProfileResponse> {
  const [existing] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  if (existing) {
    return toProfileResponse(user, existing);
  }

  const now = new Date();
  const [created] = await db
    .insert(userProfiles)
    .values({
      userId: user.id,
      headline: null,
      bio: null,
      primaryStack: JSON.stringify([]),
      cvMarkdown: null,
      cvExtractedAt: null,
      skillInsights: null,
      skillAnalyzedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toProfileResponse(user, created);
}

export async function updateProfile(
  db: Database,
  user: UserRow,
  input: UpdateProfileRequest,
): Promise<UserProfileResponse> {
  await getOrCreateProfile(db, user);

  const updates: Partial<typeof userProfiles.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.headline !== undefined) {
    updates.headline = input.headline;
  }
  if (input.bio !== undefined) {
    updates.bio = input.bio;
  }
  if (input.primaryStack !== undefined) {
    updates.primaryStack = JSON.stringify(input.primaryStack);
  }
  if (input.cvMarkdown !== undefined) {
    updates.cvMarkdown = input.cvMarkdown;
  }

  const [updated] = await db
    .update(userProfiles)
    .set(updates)
    .where(eq(userProfiles.userId, user.id))
    .returning();

  return toProfileResponse(user, updated);
}

export async function extractAndSaveCv(
  db: Database,
  env: AppEnv["Bindings"],
  user: UserRow,
  file: File,
): Promise<CvUploadResponse> {
  await getOrCreateProfile(db, user);

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  let rawText = "";

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfData = new Uint8Array(arrayBuffer);
    const { text } = await extractText(pdfData);
    rawText = Array.isArray(text) ? text.join("\n\n") : text;
  } else {
    rawText = await file.text();
  }

  const cleanRaw = rawText.trim();
  if (cleanRaw.length < 30) {
    throw new Error(
      "The uploaded file did not contain enough readable text. Please verify the file is not empty or encrypted.",
    );
  }

  let cvMarkdown = cleanRaw;
  let headline: string | null = null;
  let bio: string | null = null;
  let suggestedStack: string[] = [];

  if (env.AI_API_KEY) {
    try {
      const { data } = await extractAndFormatResume(env, cleanRaw);
      cvMarkdown = data.markdown;
      headline = data.headline;
      bio = data.bio;
      suggestedStack = data.primaryStack;
    } catch (err) {
      console.error(
        "Failed to format resume with AI, using formatted fallback:",
        err,
      );
      cvMarkdown = cleanRaw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n\n");
    }
  } else {
    cvMarkdown = cleanRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  const now = new Date();
  await db
    .update(userProfiles)
    .set({
      cvMarkdown,
      cvExtractedAt: now,
      updatedAt: now,
      ...(headline ? { headline } : {}),
      ...(bio ? { bio } : {}),
      ...(suggestedStack.length > 0
        ? { primaryStack: JSON.stringify(suggestedStack) }
        : {}),
    })
    .where(eq(userProfiles.userId, user.id));

  return {
    cvMarkdown,
    extractedAt: now.toISOString(),
    headline,
    bio,
    suggestedStack,
  };
}

export async function extractPersonaFromCv(
  db: Database,
  env: AppEnv["Bindings"],
  user: UserRow,
): Promise<UserProfileResponse> {
  const profile = await getOrCreateProfile(db, user);
  if (!profile.cvMarkdown || profile.cvMarkdown.trim().length < 30) {
    throw new Error(
      "No CV content found. Please upload or paste your CV in Markdown format first.",
    );
  }

  let headline: string | null = profile.headline;
  let bio: string | null = profile.bio;
  let primaryStack: string[] = profile.primaryStack;

  if (env.AI_API_KEY) {
    const { data } = await extractAndFormatResume(env, profile.cvMarkdown);
    if (data.headline) headline = data.headline;
    if (data.bio) bio = data.bio;
    if (data.primaryStack && data.primaryStack.length > 0) {
      primaryStack = Array.from(
        new Set([...primaryStack, ...data.primaryStack]),
      );
    }
  } else if (profile.skillInsights) {
    headline = profile.skillInsights.archetype;
    bio = profile.skillInsights.summary;
  }

  const now = new Date();
  const [updated] = await db
    .update(userProfiles)
    .set({
      headline,
      bio,
      primaryStack: JSON.stringify(primaryStack),
      updatedAt: now,
    })
    .where(eq(userProfiles.userId, user.id))
    .returning();

  return toProfileResponse(user, updated);
}

export async function analyzeAndSaveSkillInsights(
  db: Database,
  env: AppEnv["Bindings"],
  userId: string,
): Promise<AnalyzeSkillsResponse> {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (
    !profile ||
    !profile.cvMarkdown ||
    profile.cvMarkdown.trim().length < 50
  ) {
    throw new Error(
      "Please upload or provide your CV content first before analyzing skills.",
    );
  }

  // Fetch recent brag logs and notes to enrich dev context
  const recentBragLogs = await db
    .select({
      title: bragLogs.title,
      situation: bragLogs.situation,
      task: bragLogs.task,
      action: bragLogs.action,
      result: bragLogs.result,
    })
    .from(bragLogs)
    .where(eq(bragLogs.userId, userId))
    .orderBy(desc(bragLogs.createdAt))
    .limit(5);

  const recentNotes = await db
    .select({
      title: notes.title,
      content: notes.content,
    })
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.createdAt))
    .limit(5);

  const devlogEntries: string[] = [];
  for (const log of recentBragLogs) {
    devlogEntries.push(
      `- Brag Log "${log.title}": [Action] ${log.action} -> [Result] ${log.result}`,
    );
  }
  for (const note of recentNotes) {
    devlogEntries.push(`- Note "${note.title}": ${note.content.slice(0, 300)}`);
  }
  const devlogContext =
    devlogEntries.length > 0 ? devlogEntries.join("\n") : undefined;

  const { insights, usage } = await analyzeDeveloperCompetencies(
    env,
    profile.cvMarkdown,
    devlogContext,
  );

  const now = new Date();
  await db
    .update(userProfiles)
    .set({
      skillInsights: JSON.stringify(insights),
      skillAnalyzedAt: now,
      updatedAt: now,
      ...(!profile.headline ? { headline: insights.archetype } : {}),
    })
    .where(eq(userProfiles.userId, userId));

  try {
    await db.insert(aiUsage).values({
      id: nanoid(),
      userId,
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      createdAt: now,
    });
  } catch (err) {
    console.error("Failed to record AI usage for skill insights:", err);
  }

  return {
    insights,
    message: "Successfully analyzed your engineering competencies!",
  };
}
