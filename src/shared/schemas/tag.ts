import { z } from "zod";

export const tagNameSchema = z.string().trim().min(1).max(50);

export const createTagSchema = z.object({
  name: tagNameSchema,
});

export const updateTagSchema = z.object({
  name: tagNameSchema,
});

export const tagResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

export const tagListResponseSchema = z.object({
  tags: z.array(tagResponseSchema),
});

export const tagDetailResponseSchema = z.object({
  tag: tagResponseSchema,
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type TagResponse = z.infer<typeof tagResponseSchema>;
export type TagListResponse = z.infer<typeof tagListResponseSchema>;
export type TagDetailResponse = z.infer<typeof tagDetailResponseSchema>;
