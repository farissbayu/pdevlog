import { z } from "zod";

import { tagResponseSchema } from "./tag";
import { workspaceResponseSchema } from "./workspace";

const occurredAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const bragLogFieldsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  situation: z.string().trim().min(1, "Situation is required").max(5000),
  task: z.string().trim().min(1, "Task is required").max(5000),
  action: z.string().trim().min(1, "Action is required").max(5000),
  result: z.string().trim().min(1, "Result is required").max(5000),
  occurred_at: occurredAtSchema,
  workspace_id: z.string().min(1).nullable().optional(),
  tag_ids: z.array(z.string().min(1)).optional(),
});

export const createBragLogSchema = bragLogFieldsSchema;

export const updateBragLogSchema = bragLogFieldsSchema.partial();

export const bragLogResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  occurredAt: z.string(),
  workspaceId: z.string().nullable(),
  workspace: workspaceResponseSchema.nullable(),
  tags: z.array(tagResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const bragLogListResponseSchema = z.object({
  bragLogs: z.array(bragLogResponseSchema),
});

export const bragLogDetailResponseSchema = z.object({
  bragLog: bragLogResponseSchema,
});

export type CreateBragLogInput = z.infer<typeof createBragLogSchema>;
export type UpdateBragLogInput = z.infer<typeof updateBragLogSchema>;
export type BragLogResponse = z.infer<typeof bragLogResponseSchema>;
export type BragLogListResponse = z.infer<typeof bragLogListResponseSchema>;
export type BragLogDetailResponse = z.infer<typeof bragLogDetailResponseSchema>;
