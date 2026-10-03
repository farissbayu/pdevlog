import { z } from "zod";

import { attachmentResponseSchema } from "./attachment";
import { paginationMetaSchema } from "./pagination";
import {
  sourceInputSchema,
  sourceResponseSchema,
  type SourceInput,
} from "./source";
import { tagResponseSchema } from "./tag";
import { workspaceResponseSchema } from "./workspace";

const noteFieldsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required").max(100000),
  workspace_id: z.string().min(1).nullable().optional(),
  tag_ids: z.array(z.string().min(1)).optional(),
  sources: z.array(sourceInputSchema).max(20).optional(),
});

export const createNoteSchema = noteFieldsSchema.extend({
  spark_id: z.string().min(1).optional(),
  carry_attachments: z.boolean().optional(),
});

export const updateNoteSchema = noteFieldsSchema.partial();

export const noteSourceResponseSchema = sourceResponseSchema;

export const noteResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  workspaceId: z.string().nullable(),
  workspace: workspaceResponseSchema.nullable(),
  tags: z.array(tagResponseSchema),
  sources: z.array(sourceResponseSchema),
  attachments: z.array(attachmentResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const noteListResponseSchema = z.object({
  notes: z.array(noteResponseSchema),
  pagination: paginationMetaSchema,
});

export const noteDetailResponseSchema = z.object({
  note: noteResponseSchema,
});

export type NoteSourceInput = SourceInput;
export type NoteSourceResponse = z.infer<typeof noteSourceResponseSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteResponse = z.infer<typeof noteResponseSchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
export type NoteDetailResponse = z.infer<typeof noteDetailResponseSchema>;
