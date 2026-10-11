import { z } from "zod";

export const skillStrengthItemSchema = z.object({
  area: z.string().min(1),
  description: z.string().min(1),
  evidenceSummary: z.string(),
});
export type SkillStrengthItem = z.infer<typeof skillStrengthItemSchema>;

export const skillGrowthAreaItemSchema = z.object({
  area: z.string().min(1),
  gap: z.string().min(1),
  recommendation: z.string().min(1),
});
export type SkillGrowthAreaItem = z.infer<typeof skillGrowthAreaItemSchema>;

export const skillInsightsSchema = z.object({
  archetype: z.string().min(1),
  summary: z.string().min(1),
  strengths: z.array(skillStrengthItemSchema),
  growthAreas: z.array(skillGrowthAreaItemSchema),
  recommendedNextSteps: z.array(z.string()),
  analyzedAt: z.string(),
});
export type SkillInsights = z.infer<typeof skillInsightsSchema>;

export const userProfileResponseSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  primaryStack: z.array(z.string()),
  cvMarkdown: z.string().nullable(),
  cvExtractedAt: z.string().nullable(),
  skillInsights: skillInsightsSchema.nullable(),
  skillAnalyzedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

export const updateProfileRequestSchema = z.object({
  headline: z.string().max(150).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  primaryStack: z.array(z.string().trim().min(1)).max(30).optional(),
  cvMarkdown: z.string().max(100000).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const cvUploadResponseSchema = z.object({
  cvMarkdown: z.string(),
  extractedAt: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable().optional(),
  suggestedStack: z.array(z.string()),
  pageCount: z.number().int().optional(),
});
export type CvUploadResponse = z.infer<typeof cvUploadResponseSchema>;

export const analyzeSkillsResponseSchema = z.object({
  insights: skillInsightsSchema,
  message: z.string(),
});
export type AnalyzeSkillsResponse = z.infer<typeof analyzeSkillsResponseSchema>;

export const syncCvSkillsResponseSchema = z.object({
  matchedMilestonesCount: z.number().int(),
  newlyAchievedCount: z.number().int(),
  unlockedMilestones: z.array(
    z.object({
      milestoneId: z.string(),
      title: z.string(),
      pillarSlug: z.string(),
      level: z.number().int(),
      quoteSnippet: z.string(),
      aiReasoning: z.string(),
    }),
  ),
  message: z.string(),
});
export type SyncCvSkillsResponse = z.infer<typeof syncCvSkillsResponseSchema>;

export const resumeExtractionSchema = z.object({
  headline: z.string(),
  bio: z.string(),
  primaryStack: z.array(z.string()),
  markdown: z.string(),
});
export type ResumeExtraction = z.infer<typeof resumeExtractionSchema>;

export const cvMilestoneEvidenceMatchSchema = z.object({
  pillarSlug: z.enum([
    "ui-craft",
    "fullstack-data",
    "product-sense",
    "product-telemetry",
    "velocity-ai",
  ]),
  level: z.number().int().min(1).max(5),
  quoteSnippet: z.string(),
  reasoning: z.string(),
  confidenceScore: z.number().min(0).max(1),
});
export type CvMilestoneEvidenceMatch = z.infer<
  typeof cvMilestoneEvidenceMatchSchema
>;

export const cvSkillAuditResultSchema = z.object({
  candidateOverview: z.string(),
  matches: z.array(cvMilestoneEvidenceMatchSchema),
});
export type CvSkillAuditResult = z.infer<typeof cvSkillAuditResultSchema>;
