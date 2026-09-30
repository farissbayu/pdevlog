import { queryOptions, useQuery } from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type { DashboardResponse } from "@/shared/schemas/dashboard";

const DASHBOARD_KEY = ["dashboard"] as const;

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await client.api.dashboard.$get();
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load dashboard");
  }
  return (await response.json()) as DashboardResponse;
}

export const dashboardQueryOptions = queryOptions({
  queryKey: DASHBOARD_KEY,
  queryFn: fetchDashboard,
});

export function useDashboardQuery() {
  return useQuery(dashboardQueryOptions);
}
