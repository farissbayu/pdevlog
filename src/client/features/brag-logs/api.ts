import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  BragLogDetailResponse,
  BragLogListResponse,
  BragLogResponse,
  CreateBragLogInput,
  UpdateBragLogInput,
} from "@/shared/schemas/brag-log";

const BRAG_LOGS_KEY = ["brag-logs"] as const;

export async function fetchBragLogs(): Promise<BragLogResponse[]> {
  const response = await client.api["brag-logs"].$get();
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load brag logs");
  }
  const data = (await response.json()) as BragLogListResponse;
  return data.bragLogs;
}

export async function fetchBragLog(id: string): Promise<BragLogResponse> {
  const response = await client.api["brag-logs"][":id"].$get({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load brag log");
  }
  const data = (await response.json()) as BragLogDetailResponse;
  return data.bragLog;
}

export async function createBragLog(
  input: CreateBragLogInput,
): Promise<BragLogResponse> {
  const response = await client.api["brag-logs"].$post({ json: input });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to create brag log");
  }
  const data = (await response.json()) as BragLogDetailResponse;
  return data.bragLog;
}

export async function updateBragLog(
  id: string,
  input: UpdateBragLogInput,
): Promise<BragLogResponse> {
  const response = await client.api["brag-logs"][":id"].$put({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update brag log");
  }
  const data = (await response.json()) as BragLogDetailResponse;
  return data.bragLog;
}

export async function deleteBragLog(id: string): Promise<void> {
  const response = await client.api["brag-logs"][":id"].$delete({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete brag log");
  }
}

export const bragLogsQueryOptions = queryOptions({
  queryKey: BRAG_LOGS_KEY,
  queryFn: fetchBragLogs,
});

export function bragLogDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...BRAG_LOGS_KEY, id],
    queryFn: () => fetchBragLog(id),
    enabled: Boolean(id),
  });
}

export function useBragLogsQuery() {
  return useQuery(bragLogsQueryOptions);
}

export function useBragLogDetailQuery(id: string) {
  return useQuery(bragLogDetailQueryOptions(id));
}

export function useCreateBragLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBragLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRAG_LOGS_KEY });
    },
  });
}

export function useUpdateBragLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBragLogInput }) =>
      updateBragLog(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: BRAG_LOGS_KEY });
      queryClient.invalidateQueries({
        queryKey: [...BRAG_LOGS_KEY, variables.id],
      });
    },
  });
}

export function useDeleteBragLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBragLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRAG_LOGS_KEY });
    },
  });
}
