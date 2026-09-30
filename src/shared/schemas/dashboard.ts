import { z } from "zod";

import { workspaceResponseSchema } from "./workspace";

export const dashboardStatsSchema = z.object({
  workspaces: z.number(),
  bragLogs: z.number(),
  learningNotes: z.number(),
});

export const dashboardResponseSchema = z.object({
  stats: dashboardStatsSchema,
  recentWorkspaces: z.array(workspaceResponseSchema),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
