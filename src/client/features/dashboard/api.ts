import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import {
  checkInsResponseSchema,
  type CheckInsResponse,
} from "@/shared/schemas/check-in";
import type {
  ActivityItem,
  DashboardResponse,
  RecentActivityResponse,
} from "@/shared/schemas/dashboard";
import {
  dailySuggestionResponseSchema,
  type DailySuggestionResponse,
  type SuggestionActionInput,
} from "@/shared/schemas/learning-suggestion";

const DASHBOARD_KEY = ["dashboard"] as const;
const RECENT_ACTIVITY_KEY = ["dashboard", "recent"] as const;
const CHECK_INS_KEY = ["dashboard", "check-ins"] as const;
const LEARNING_SUGGESTION_KEY = ["dashboard", "learning-suggestion"] as const;

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

export async function fetchCheckIns(): Promise<CheckInsResponse> {
  const tzOffset = -new Date().getTimezoneOffset();
  const response = await client.api.dashboard["check-ins"].$get({
    query: { tz_offset: tzOffset },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load check-ins");
  }
  return checkInsResponseSchema.parse(await response.json());
}

export const dashboardQueryOptions = queryOptions({
  queryKey: DASHBOARD_KEY,
  queryFn: fetchDashboard,
});

export const checkInsQueryOptions = queryOptions({
  queryKey: CHECK_INS_KEY,
  queryFn: fetchCheckIns,
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

export function useCheckInsQuery() {
  return useQuery(checkInsQueryOptions);
}

export async function fetchLearningSuggestion(): Promise<DailySuggestionResponse> {
  const tzOffset = -new Date().getTimezoneOffset();
  const response = await client.api.dashboard["learning-suggestion"].$get({
    query: { tz_offset: tzOffset },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load learning suggestion");
  }
  return dailySuggestionResponseSchema.parse(await response.json());
}

export async function generateLearningSuggestion(): Promise<DailySuggestionResponse> {
  const tzOffset = -new Date().getTimezoneOffset();
  const response = await client.api.dashboard["learning-suggestion"].generate.$post(
    { json: { tz_offset: tzOffset } },
  );
  if (!response.ok) {
    throw await parseApiError(response, "Failed to generate a suggestion");
  }
  return dailySuggestionResponseSchema.parse(await response.json());
}

export async function regenerateLearningSuggestion(): Promise<DailySuggestionResponse> {
  const tzOffset = -new Date().getTimezoneOffset();
  const response =
    await client.api.dashboard["learning-suggestion"].regenerate.$post({
      json: { tz_offset: tzOffset },
    });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to regenerate the suggestion");
  }
  return dailySuggestionResponseSchema.parse(await response.json());
}

export async function updateLearningSuggestionStatus(
  id: string,
  status: SuggestionActionInput["status"],
): Promise<void> {
  const response = await client.api.dashboard["learning-suggestion"][
    ":id"
  ].action.$post({ param: { id }, json: { status } });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update the suggestion");
  }
}

export const learningSuggestionQueryOptions = queryOptions({
  queryKey: LEARNING_SUGGESTION_KEY,
  queryFn: fetchLearningSuggestion,
});

export function useLearningSuggestionQuery() {
  return useQuery(learningSuggestionQueryOptions);
}

export function useGenerateLearningSuggestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateLearningSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_SUGGESTION_KEY });
    },
  });
}

export function useRegenerateLearningSuggestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: regenerateLearningSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_SUGGESTION_KEY });
    },
  });
}

export function useUpdateLearningSuggestionStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: SuggestionActionInput["status"];
    }) => updateLearningSuggestionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_SUGGESTION_KEY });
    },
  });
}
