import { z } from "zod";

import { tagResponseSchema } from "./tag";
import { workspaceResponseSchema } from "./workspace";

const learningNoteFieldsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required").max(100000),
  workspace_id: z.string().min(1).nullable().optional(),
  tag_ids: z.array(z.string().min(1)).optional(),
});

export const createLearningNoteSchema = learningNoteFieldsSchema;

export const updateLearningNoteSchema = learningNoteFieldsSchema.partial();

export const learningNoteResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  workspaceId: z.string().nullable(),
  workspace: workspaceResponseSchema.nullable(),
  tags: z.array(tagResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const learningNoteListResponseSchema = z.object({
  learningNotes: z.array(learningNoteResponseSchema),
});

export const learningNoteDetailResponseSchema = z.object({
  learningNote: learningNoteResponseSchema,
});

export type CreateLearningNoteInput = z.infer<typeof createLearningNoteSchema>;
export type UpdateLearningNoteInput = z.infer<typeof updateLearningNoteSchema>;
export type LearningNoteResponse = z.infer<typeof learningNoteResponseSchema>;
export type LearningNoteListResponse = z.infer<
  typeof learningNoteListResponseSchema
>;
export type LearningNoteDetailResponse = z.infer<
  typeof learningNoteDetailResponseSchema
>;
