import { z } from "zod";

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const meResponseSchema = z.object({
  user: userResponseSchema,
});

export const errorResponseSchema = z.object({
  error: z.string(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
