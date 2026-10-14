import { z } from "zod";

export const checkInDaySchema = z.object({
  date: z.string(),
  total: z.number().int(),
  bragLogs: z.number().int(),
  notes: z.number().int(),
  sparks: z.number().int(),
  projectItems: z.number().int(),
});

export const checkInsResponseSchema = z.object({
  days: z.array(checkInDaySchema),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  todayActive: z.boolean(),
});

export const checkInsQuerySchema = z.object({
  tz_offset: z.coerce.number().int().min(-840).max(840).default(0),
});

export type CheckInDay = z.infer<typeof checkInDaySchema>;
export type CheckInsResponse = z.infer<typeof checkInsResponseSchema>;
export type CheckInsQuery = z.infer<typeof checkInsQuerySchema>;
