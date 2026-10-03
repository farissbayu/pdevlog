import { z } from "zod";

import { paginationMetaSchema, paginationQuerySchema } from "./pagination";

const searchSchema = z.string().trim().max(200).optional();

export const adminUserFilterSchema = z
  .object({
    q: searchSchema,
  })
  .extend(paginationQuerySchema.shape);

export const adminUserUsageSchema = z.object({
  workspaces: z.number().int(),
  bragLogs: z.number().int(),
  notes: z.number().int(),
  sparks: z.number().int(),
  attachments: z.number().int(),
  storageBytes: z.number().int(),
  aiCalls: z.number().int(),
  aiTokens: z.number().int(),
});

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  usage: adminUserUsageSchema,
});

export const adminUserListResponseSchema = z.object({
  users: z.array(adminUserSchema),
  pagination: paginationMetaSchema,
});

export type AdminUserFilterInput = z.infer<typeof adminUserFilterSchema>;
export type AdminUserUsage = z.infer<typeof adminUserUsageSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUserListResponse = z.infer<
  typeof adminUserListResponseSchema
>;
