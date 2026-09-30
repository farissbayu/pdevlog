import z from "zod";

const tagNameSchema = z.string().trim().min(1).max(50);

export const createTagSchema = z.object({
  name: tagNameSchema,
});

export const updateTagSchema = z.object({
  name: tagNameSchema.optional(),
});

export const tagResponseSchema = z.object({
  name: z.string(),
});
