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
import type { PaginationMeta } from "@/shared/schemas/pagination";
import type { AttachmentResponse } from "@/shared/schemas/attachment";
import type {
  CreateSparkInput,
  SparkDetailResponse,
  SparkListResponse,
  SparkRandomResponse,
  SparkResponse,
  UpdateSparkInput,
} from "@/shared/schemas/spark";

const SPARKS_KEY = ["sparks"] as const;
const DASHBOARD_KEY = ["dashboard"] as const;

export type SparkListResult = {
  sparks: SparkResponse[];
  pagination: PaginationMeta;
};

export async function fetchSparks(
  filters: FilterParams,
): Promise<SparkListResult> {
  const response = await client.api.sparks.$get({
    query: buildFilterQuery(filters),
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load sparks");
  }
  const data = (await response.json()) as SparkListResponse;
  return { sparks: data.sparks, pagination: data.pagination };
}

export async function fetchSpark(id: string): Promise<SparkResponse> {
  const response = await client.api.sparks[":id"].$get({ param: { id } });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load spark");
  }
  const data = (await response.json()) as SparkDetailResponse;
  return data.spark;
}

export async function createSpark(
  input: CreateSparkInput,
): Promise<SparkResponse> {
  const response = await client.api.sparks.$post({ json: input });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to save spark");
  }
  const data = (await response.json()) as SparkDetailResponse;
  return data.spark;
}

export async function updateSpark(
  id: string,
  input: UpdateSparkInput,
): Promise<SparkResponse> {
  const response = await client.api.sparks[":id"].$put({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update spark");
  }
  const data = (await response.json()) as SparkDetailResponse;
  return data.spark;
}

export async function deleteSpark(id: string): Promise<void> {
  const response = await client.api.sparks[":id"].$delete({ param: { id } });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete spark");
  }
}

export async function fetchRandomSpark(): Promise<SparkResponse> {
  const response = await client.api.sparks.random.$get();
  if (!response.ok) {
    throw await parseApiError(response, "No sparks to recall");
  }
  const data = (await response.json()) as SparkRandomResponse;
  return data.spark;
}

export async function uploadSparkAttachment(
  sparkId: string,
  file: File,
): Promise<AttachmentResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`/api/sparks/${sparkId}/attachments`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to upload image");
  }
  const data = (await response.json()) as { attachment: AttachmentResponse };
  return data.attachment;
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const response = await fetch(`/api/sparks/attachments/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete image");
  }
}

export function useUploadSparkAttachmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sparkId, file }: { sparkId: string; file: File }) =>
      uploadSparkAttachment(sparkId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SPARKS_KEY });
    },
  });
}

export function useDeleteAttachmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SPARKS_KEY });
    },
  });
}

export function sparksQueryOptions(filters: FilterParams = EMPTY_FILTERS) {
  return queryOptions({
    queryKey: [...SPARKS_KEY, filters],
    queryFn: () => fetchSparks(filters),
  });
}

export function sparkDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...SPARKS_KEY, id],
    queryFn: () => fetchSpark(id),
    enabled: Boolean(id),
  });
}

export function useSparksQuery(filters: FilterParams = EMPTY_FILTERS) {
  return useQuery(sparksQueryOptions(filters));
}

export function useSparkDetailQuery(id: string) {
  return useQuery(sparkDetailQueryOptions(id));
}

export function useCreateSparkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSpark,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SPARKS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

export function useUpdateSparkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSparkInput }) =>
      updateSpark(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SPARKS_KEY });
      queryClient.invalidateQueries({
        queryKey: [...SPARKS_KEY, variables.id],
      });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

export function useDeleteSparkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSpark,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SPARKS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

export function useRecallSparkMutation() {
  return useMutation({ mutationFn: fetchRandomSpark });
}
