import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type { PaginationMeta } from "@/shared/schemas/pagination";
import type {
  CreateTagInput,
  TagDetailResponse,
  TagListResponse,
  TagResponse,
  UpdateTagInput,
} from "@/shared/schemas/tag";

const TAGS_KEY = ["tags"] as const;

export type TagListParams = {
  q?: string;
  page?: number;
};

export type TagListResult = {
  tags: TagResponse[];
  pagination: PaginationMeta;
};

function buildTagQuery(params: TagListParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.q) {
    query.q = params.q;
  }
  if (params.page !== undefined) {
    query.page = String(params.page);
  }
  return query;
}

export async function fetchTags(
  params: TagListParams = {},
): Promise<TagListResult> {
  const response = await client.api.tags.$get({
    query: buildTagQuery(params),
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load tags");
  }
  const data = (await response.json()) as TagListResponse;
  return { tags: data.tags, pagination: data.pagination };
}

export async function createTag(input: CreateTagInput): Promise<TagResponse> {
  const response = await client.api.tags.$post({ json: input });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to create tag");
  }
  const data = (await response.json()) as TagDetailResponse;
  return data.tag;
}

export async function updateTag(
  id: string,
  input: UpdateTagInput,
): Promise<TagResponse> {
  const response = await client.api.tags[":id"].$put({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update tag");
  }
  const data = (await response.json()) as TagDetailResponse;
  return data.tag;
}

export async function deleteTag(id: string): Promise<void> {
  const response = await client.api.tags[":id"].$delete({ param: { id } });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete tag");
  }
}

export const tagsQueryOptions = queryOptions({
  queryKey: [...TAGS_KEY, "options"],
  queryFn: () => fetchTags(),
  select: (data) => data.tags,
});

export function tagsListQueryOptions(params: TagListParams) {
  return queryOptions({
    queryKey: [...TAGS_KEY, "list", params],
    queryFn: () => fetchTags(params),
  });
}

export function useTagsQuery() {
  return useQuery(tagsQueryOptions);
}

export function useTagsListQuery(params: TagListParams) {
  return useQuery(tagsListQueryOptions(params));
}

export function useCreateTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}

export function useUpdateTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTagInput }) =>
      updateTag(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}
