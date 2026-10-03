import { z } from "zod";

export const sourceKinds = [
  "video",
  "course",
  "book",
  "article",
  "link",
  "other",
] as const;

export const sourceKindSchema = z.enum(sourceKinds);

function optionalTrimmedString(max: number) {
  return z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z.string().max(max).optional(),
    )
    .transform((value) => (value ? value : undefined));
}

const optionalSourceUrl = z
  .preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .string()
      .max(2048)
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "Source URL must start with http:// or https://",
      })
      .optional(),
  )
  .transform((value) => (value ? value : undefined));

export const sourceInputSchema = z
  .object({
    url: optionalSourceUrl,
    label: optionalTrimmedString(200),
    kind: sourceKindSchema.optional(),
    locator: optionalTrimmedString(200),
  })
  .refine((value) => Boolean(value.url) || Boolean(value.label), {
    message: "A source needs a URL or a label",
  });

export const sourceResponseSchema = z.object({
  id: z.string(),
  url: z.string().nullable(),
  label: z.string().nullable(),
  kind: sourceKindSchema.nullable(),
  locator: z.string().nullable(),
});

export type SourceInput = z.infer<typeof sourceInputSchema>;
export type SourceResponse = z.infer<typeof sourceResponseSchema>;
