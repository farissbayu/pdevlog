import { z } from "zod";

import { paginationMetaSchema } from "./pagination";

export const projectStatusSchema = z.enum([
  "active",
  "maintenance",
  "archived",
]);

export const projectItemKindSchema = z.enum([
  "feat",
  "fix",
  "perf",
  "refactor",
  "spike",
  "docs",
]);

export const projectItemStatusSchema = z.enum([
  "backlog",
  "in_progress",
  "shipped",
  "dropped",
]);

const projectNameSchema = z.string().trim().min(1).max(120);
const optionalText = (max: number) => z.string().trim().max(max).nullable();
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\//.test(value), {
    message: "Must be a valid http(s) URL",
  })
  .nullable();

export const createProjectSchema = z.object({
  workspace_id: z.string().min(1),
  name: projectNameSchema,
  tagline: optionalText(200).optional(),
  description: optionalText(5000).optional(),
  repo_url: optionalUrl.optional(),
  live_url: optionalUrl.optional(),
  status: projectStatusSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: projectNameSchema.optional(),
  tagline: optionalText(200).optional(),
  description: optionalText(5000).optional(),
  repo_url: optionalUrl.optional(),
  live_url: optionalUrl.optional(),
  status: projectStatusSchema.optional(),
});

export const createProjectItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  kind: projectItemKindSchema.optional(),
  status: projectItemStatusSchema.optional(),
  target_version: z.string().trim().min(1).max(100).optional(),
  spark_id: z.string().min(1).optional(),
});

export const updateProjectItemSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  kind: projectItemKindSchema.optional(),
  status: projectItemStatusSchema.optional(),
  target_version: z.string().trim().min(1).max(100).optional(),
  position: z.number().int().optional(),
});

export const shipProjectItemSchema = z.object({
  version: z.string().trim().min(1).max(100).optional(),
});

export const projectResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  repoUrl: z.string().nullable(),
  liveUrl: z.string().nullable(),
  status: projectStatusSchema,
  backlogCount: z.number().int(),
  shippedCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectListResponseSchema = z.object({
  projects: z.array(projectResponseSchema),
  pagination: paginationMetaSchema,
});

export const projectDetailResponseSchema = z.object({
  project: projectResponseSchema,
});

export const projectItemResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  kind: projectItemKindSchema,
  status: projectItemStatusSchema,
  targetVersion: z.string(),
  position: z.number().int(),
  shippedAt: z.string().nullable(),
  shippedVersion: z.string().nullable(),
  bragLogId: z.string().nullable(),
  noteId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectItemListResponseSchema = z.object({
  items: z.array(projectItemResponseSchema),
});

export const projectItemDetailResponseSchema = z.object({
  item: projectItemResponseSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateProjectItemInput = z.infer<typeof createProjectItemSchema>;
export type UpdateProjectItemInput = z.infer<typeof updateProjectItemSchema>;
export type ShipProjectItemInput = z.infer<typeof shipProjectItemSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectItemKind = z.infer<typeof projectItemKindSchema>;
export type ProjectItemStatus = z.infer<typeof projectItemStatusSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;
export type ProjectItemResponse = z.infer<typeof projectItemResponseSchema>;
export type ProjectItemListResponse = z.infer<
  typeof projectItemListResponseSchema
>;
export type ProjectItemDetailResponse = z.infer<
  typeof projectItemDetailResponseSchema
>;
