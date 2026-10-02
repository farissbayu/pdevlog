import { z } from "zod";

import { paginationQuerySchema } from "./pagination";

const filterQueryValueSchema = z
  .union([z.string(), z.array(z.string())])
  .optional();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional();

const searchSchema = z.string().trim().max(200).optional();

export const UNASSIGNED_WORKSPACE = "none";

const baseFilterSchema = z
  .object({
    q: searchSchema,
    workspace_id: z.string().min(1).optional(),
    tag_id: filterQueryValueSchema,
    from: dateSchema,
    to: dateSchema,
  })
  .extend(paginationQuerySchema.shape);

export const logFilterSchema = baseFilterSchema;
export const noteFilterSchema = baseFilterSchema;

export const sparkFilterSchema = z
  .object({
    q: searchSchema,
    tag_id: filterQueryValueSchema,
    from: dateSchema,
    to: dateSchema,
    status: z.enum(["open", "archived", "promoted"]).optional(),
  })
  .extend(paginationQuerySchema.shape);

export const workspaceFilterSchema = z
  .object({
    q: searchSchema,
  })
  .extend(paginationQuerySchema.shape);

export const tagFilterSchema = z
  .object({
    q: searchSchema,
  })
  .extend(paginationQuerySchema.shape);

export type LogFilterInput = z.infer<typeof logFilterSchema>;
export type NoteFilterInput = z.infer<typeof noteFilterSchema>;
export type SparkFilterInput = z.infer<typeof sparkFilterSchema>;
export type WorkspaceFilterInput = z.infer<typeof workspaceFilterSchema>;
export type TagFilterInput = z.infer<typeof tagFilterSchema>;

export function normalizeTagIds(
  value: string | string[] | undefined,
): string[] {
  if (!value) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.filter((id) => id.length > 0))];
}
