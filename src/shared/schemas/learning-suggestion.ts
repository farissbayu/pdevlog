import { z } from "zod";

export const MAX_DAILY_REGENERATIONS = 3;

export const learningSuggestionStatuses = [
  "active",
  "saved_as_spark",
  "converted_to_note",
  "dismissed",
] as const;

export const learningSuggestionStatusSchema = z.enum(
  learningSuggestionStatuses,
);

export const suggestionSourceKinds = [
  "brag-log",
  "note",
  "project-item",
] as const;

export const suggestionSourceSchema = z.object({
  kind: z.enum(suggestionSourceKinds),
  title: z.string(),
});

export function parseSuggestionSources(
  raw: string | null | undefined,
): SuggestionSource[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = z.array(suggestionSourceSchema).safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export const dailyLearningSuggestionSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  category: z.string(),
  reason: z.string(),
  practicalNextStep: z.string(),
  suggestedOutline: z.string().nullable(),
  suggestedTags: z.array(z.string()),
  sourceItems: z.array(suggestionSourceSchema),
  sourceContextSummary: z.string().nullable(),
  regenerateCount: z.number().int(),
  regenerationsLeft: z.number().int(),
  status: learningSuggestionStatusSchema,
  createdAt: z.string(),
});

export const dailySuggestionResponseSchema = z.object({
  suggestion: dailyLearningSuggestionSchema.nullable(),
  hasRecentActivity: z.boolean(),
  todayKey: z.string(),
  regenerationsLeft: z.number().int(),
});

const tzOffsetSchema = z.coerce.number().int().min(-840).max(840).default(0);

export const dailySuggestionQuerySchema = z.object({
  tz_offset: tzOffsetSchema,
});

export const suggestionTzBodySchema = z.object({
  tz_offset: tzOffsetSchema,
});

export const suggestionActionSchema = z.object({
  status: z.enum(["saved_as_spark", "converted_to_note"]),
});

export type LearningSuggestionStatus = z.infer<
  typeof learningSuggestionStatusSchema
>;
export type SuggestionSourceKind = (typeof suggestionSourceKinds)[number];
export type SuggestionSource = z.infer<typeof suggestionSourceSchema>;
export type DailyLearningSuggestion = z.infer<
  typeof dailyLearningSuggestionSchema
>;
export type DailySuggestionResponse = z.infer<
  typeof dailySuggestionResponseSchema
>;
export type DailySuggestionQuery = z.infer<typeof dailySuggestionQuerySchema>;
export type SuggestionTzBody = z.infer<typeof suggestionTzBodySchema>;
export type SuggestionActionInput = z.infer<typeof suggestionActionSchema>;
