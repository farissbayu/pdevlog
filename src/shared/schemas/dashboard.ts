import { z } from "zod";

import { tagResponseSchema } from "./tag";
import { workspaceResponseSchema } from "./workspace";

export const dashboardStatsSchema = z.object({
  workspaces: z.number(),
  bragLogs: z.number(),
  learningNotes: z.number(),
  sparks: z.number(),
});

export const dashboardResponseSchema = z.object({
  stats: dashboardStatsSchema,
  recentWorkspaces: z.array(workspaceResponseSchema),
});

export const activityTypeSchema = z.enum([
  "brag-log",
  "learning-note",
  "spark",
]);

export const activityItemSchema = z.object({
  id: z.string(),
  type: activityTypeSchema,
  title: z.string(),
  date: z.string(),
  tags: z.array(tagResponseSchema),
  workspace: workspaceResponseSchema.nullable(),
});

export const recentActivityResponseSchema = z.object({
  items: z.array(activityItemSchema),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type ActivityItem = z.infer<typeof activityItemSchema>;
export type RecentActivityResponse = z.infer<
  typeof recentActivityResponseSchema
>;
