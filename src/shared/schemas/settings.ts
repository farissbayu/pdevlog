import { z } from "zod";

const optionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional();

export const exportLogsQuerySchema = z.object({
  from: optionalDateSchema,
  to: optionalDateSchema,
});

export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

export const deleteAccountSchema = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
});

export type ExportLogsQuery = z.infer<typeof exportLogsQuerySchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
