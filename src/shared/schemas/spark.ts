import { z } from "zod";

import { attachmentResponseSchema } from "./attachment";
import { paginationMetaSchema } from "./pagination";
import { tagResponseSchema } from "./tag";

export const sparkStatusSchema = z.enum(["open", "archived", "promoted"]);
export const sparkPromotionTypeSchema = z.enum([
  "brag-log",
  "learning-note",
  "workspace",
]);

export const createSparkSchema = z.object({
  content: z.string().trim().max(10000).default(""),
  tag_ids: z.array(z.string().min(1)).optional(),
});

export const updateSparkSchema = z.object({
  content: z.string().trim().min(1, "Content is required").max(10000).optional(),
  tag_ids: z.array(z.string().min(1)).optional(),
  status: z.enum(["open", "archived"]).optional(),
});

export const sparkResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: sparkStatusSchema,
  promotedType: sparkPromotionTypeSchema.nullable(),
  promotedId: z.string().nullable(),
  tags: z.array(tagResponseSchema),
  attachments: z.array(attachmentResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sparkListResponseSchema = z.object({
  sparks: z.array(sparkResponseSchema),
  pagination: paginationMetaSchema,
});

export const sparkDetailResponseSchema = z.object({
  spark: sparkResponseSchema,
});

export const sparkRandomResponseSchema = z.object({
  spark: sparkResponseSchema,
});

export function sparkTitle(content: string, max = 120): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) {
    return "Untitled spark";
  }
  return firstLine.length > max ? `${firstLine.slice(0, max).trimEnd()}…` : firstLine;
}

export type SparkStatus = z.infer<typeof sparkStatusSchema>;
export type SparkPromotionType = z.infer<typeof sparkPromotionTypeSchema>;
export type CreateSparkInput = z.infer<typeof createSparkSchema>;
export type UpdateSparkInput = z.infer<typeof updateSparkSchema>;
export type SparkResponse = z.infer<typeof sparkResponseSchema>;
export type SparkListResponse = z.infer<typeof sparkListResponseSchema>;
export type SparkDetailResponse = z.infer<typeof sparkDetailResponseSchema>;
export type SparkRandomResponse = z.infer<typeof sparkRandomResponseSchema>;
