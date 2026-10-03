import { z } from "zod";

import { paginationMetaSchema } from "./pagination";
import { sourceInputSchema, sourceResponseSchema } from "./source";

export const workspaceTypeSchema = z.enum(["work", "learning", "general"]);

const workspaceNameSchema = z.string().trim().min(1).max(100);
const workspaceDescriptionSchema = z.string().trim().max(2000);

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  description: workspaceDescriptionSchema.nullable().optional(),
  type: workspaceTypeSchema,
  sources: z.array(sourceInputSchema).max(20).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: workspaceNameSchema.optional(),
  description: workspaceDescriptionSchema.nullable().optional(),
  type: workspaceTypeSchema.optional(),
  sources: z.array(sourceInputSchema).max(20).optional(),
});

export const workspaceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: workspaceTypeSchema,
  sources: z.array(sourceResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceListResponseSchema = z.object({
  workspaces: z.array(workspaceResponseSchema),
  pagination: paginationMetaSchema,
});

export const workspaceDetailResponseSchema = z.object({
  workspace: workspaceResponseSchema,
});

export type WorkspaceTypeInput = z.infer<typeof workspaceTypeSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;
export type WorkspaceDetailResponse = z.infer<
  typeof workspaceDetailResponseSchema
>;
