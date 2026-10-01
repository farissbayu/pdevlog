import { z } from "zod";

const filterQueryValueSchema = z
  .union([z.string(), z.array(z.string())])
  .optional();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional();

const baseFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  workspace_id: z.string().min(1).optional(),
  tag_id: filterQueryValueSchema,
  from: dateSchema,
  to: dateSchema,
});

export const logFilterSchema = baseFilterSchema;
export const noteFilterSchema = baseFilterSchema;

export type LogFilterInput = z.infer<typeof logFilterSchema>;
export type NoteFilterInput = z.infer<typeof noteFilterSchema>;

export function normalizeTagIds(
  value: string | string[] | undefined,
): string[] {
  if (!value) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.filter((id) => id.length > 0))];
}
