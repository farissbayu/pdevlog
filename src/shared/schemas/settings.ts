import { z } from "zod";

const optionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional();

export const exportFormatSchema = z.enum(["star", "bullets"]);

// format is deliberately .optional() (not .default("star")) so zValidator's
// input and output types stay identical and hc<AppType> callers can omit it.
export const exportLogsQuerySchema = z.object({
  from: optionalDateSchema,
  to: optionalDateSchema,
  format: exportFormatSchema.optional(),
});

export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

export const deleteAccountSchema = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
});

export type ExportLogsQuery = z.infer<typeof exportLogsQuerySchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
