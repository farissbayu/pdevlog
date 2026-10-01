import { z } from "zod";

import { paginationMetaSchema } from "./pagination";
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

export const starBreakdownInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(20, "Add a bit more detail before generating")
    .max(5000),
});

export const starBreakdownSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe(
      "A short, specific headline under 120 characters summarising the achievement.",
    ),
  situation: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .describe("The context or background leading up to the work."),
  task: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .describe("The goal or challenge that needed to be addressed."),
  action: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .describe("The concrete steps taken to address the task."),
  result: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .describe("The outcome or impact of the action."),
  tag_ids: z
    .array(z.string().min(1))
    .max(20)
    .describe("IDs of the applicable tags from the provided list."),
});

export const starBreakdownResponseSchema = z.object({
  breakdown: starBreakdownSchema,
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
  pagination: paginationMetaSchema,
});

export const bragLogDetailResponseSchema = z.object({
  bragLog: bragLogResponseSchema,
});

export type CreateBragLogInput = z.infer<typeof createBragLogSchema>;
export type UpdateBragLogInput = z.infer<typeof updateBragLogSchema>;
export type BragLogResponse = z.infer<typeof bragLogResponseSchema>;
export type BragLogListResponse = z.infer<typeof bragLogListResponseSchema>;
export type BragLogDetailResponse = z.infer<typeof bragLogDetailResponseSchema>;
export type StarBreakdownInput = z.infer<typeof starBreakdownInputSchema>;
export type StarBreakdown = z.infer<typeof starBreakdownSchema>;
export type StarBreakdownResponse = z.infer<typeof starBreakdownResponseSchema>;
