import { queryOptions, useQuery } from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  ActivityItem,
  DashboardResponse,
  RecentActivityResponse,
} from "@/shared/schemas/dashboard";

const DASHBOARD_KEY = ["dashboard"] as const;
const RECENT_ACTIVITY_KEY = ["dashboard", "recent"] as const;

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await client.api.dashboard.$get();
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load dashboard");
  }
  return (await response.json()) as DashboardResponse;
}

export async function fetchRecentActivity(): Promise<ActivityItem[]> {
  const response = await client.api.dashboard.recent.$get();
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load recent activity");
  }
  const data = (await response.json()) as RecentActivityResponse;
  return data.items;
}

export const dashboardQueryOptions = queryOptions({
  queryKey: DASHBOARD_KEY,
  queryFn: fetchDashboard,
});

export const recentActivityQueryOptions = queryOptions({
  queryKey: RECENT_ACTIVITY_KEY,
  queryFn: fetchRecentActivity,
});

export function useDashboardQuery() {
  return useQuery(dashboardQueryOptions);
}

export function useRecentActivityQuery() {
  return useQuery(recentActivityQueryOptions);
}
