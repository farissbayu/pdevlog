import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import {
  EMPTY_FILTERS,
  buildFilterQuery,
  type FilterParams,
} from "@/client/lib/use-filter-params";
import type {
  BragLogDetailResponse,
  BragLogListResponse,
  BragLogResponse,
  CreateBragLogInput,
  StarBreakdown,
  StarBreakdownInput,
  StarBreakdownResponse,
  UpdateBragLogInput,
} from "@/shared/schemas/brag-log";
import type { PaginationMeta } from "@/shared/schemas/pagination";

const BRAG_LOGS_KEY = ["brag-logs"] as const;

export type BragLogListResult = {
  bragLogs: BragLogResponse[];
  pagination: PaginationMeta;
};

export async function fetchBragLogs(
  filters: FilterParams,
): Promise<BragLogListResult> {
  const response = await client.api["brag-logs"].$get({
    query: buildFilterQuery(filters),
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load brag logs");
  }
  const data = (await response.json()) as BragLogListResponse;
  return { bragLogs: data.bragLogs, pagination: data.pagination };
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

export async function generateStarBreakdown(
  input: StarBreakdownInput,
): Promise<StarBreakdown> {
  const response = await client.api["brag-logs"]["star-breakdown"].$post({
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to generate STAR breakdown");
  }
  const data = (await response.json()) as StarBreakdownResponse;
  return data.breakdown;
}

export function bragLogsQueryOptions(filters: FilterParams = EMPTY_FILTERS) {
  return queryOptions({
    queryKey: [...BRAG_LOGS_KEY, filters],
    queryFn: () => fetchBragLogs(filters),
  });
}

export function bragLogDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...BRAG_LOGS_KEY, id],
    queryFn: () => fetchBragLog(id),
    enabled: Boolean(id),
  });
}

export function useBragLogsQuery(filters: FilterParams = EMPTY_FILTERS) {
  return useQuery(bragLogsQueryOptions(filters));
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

export function useGenerateStarBreakdownMutation() {
  return useMutation({
    mutationFn: generateStarBreakdown,
  });
}
