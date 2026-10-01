import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client } from "@/client/lib/api";
import type { PaginationMeta } from "@/shared/schemas/pagination";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceDetailResponse,
  WorkspaceListResponse,
  WorkspaceResponse,
} from "@/shared/schemas/workspace";

const WORKSPACES_KEY = ["workspaces"] as const;

export type WorkspaceListParams = {
  q?: string;
  page?: number;
};

export type WorkspaceListResult = {
  workspaces: WorkspaceResponse[];
  pagination: PaginationMeta;
};

function buildWorkspaceQuery(
  params: WorkspaceListParams,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.q) {
    query.q = params.q;
  }
  if (params.page !== undefined) {
    query.page = String(params.page);
  }
  return query;
}

export async function fetchWorkspaces(
  params: WorkspaceListParams = {},
): Promise<WorkspaceListResult> {
  const response = await client.api.workspaces.$get({
    query: buildWorkspaceQuery(params),
  });
  if (!response.ok) {
    throw new Error("Failed to load workspaces");
  }
  const data = (await response.json()) as WorkspaceListResponse;
  return { workspaces: data.workspaces, pagination: data.pagination };
}

export async function fetchWorkspace(id: string): Promise<WorkspaceResponse> {
  const response = await client.api.workspaces[":id"].$get({ param: { id } });
  if (!response.ok) {
    throw new Error("Workspace not found");
  }
  const data = (await response.json()) as WorkspaceDetailResponse;
  return data.workspace;
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<WorkspaceResponse> {
  const response = await client.api.workspaces.$post({ json: input });
  if (!response.ok) {
    throw new Error("Failed to create workspace");
  }
  const data = (await response.json()) as WorkspaceDetailResponse;
  return data.workspace;
}

export async function updateWorkspace(
  id: string,
  input: UpdateWorkspaceInput,
): Promise<WorkspaceResponse> {
  const response = await client.api.workspaces[":id"].$put({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw new Error("Failed to update workspace");
  }
  const data = (await response.json()) as WorkspaceDetailResponse;
  return data.workspace;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const response = await client.api.workspaces[":id"].$delete({
    param: { id },
  });
  if (!response.ok) {
    throw new Error("Failed to delete workspace");
  }
}

export const workspacesQueryOptions = queryOptions({
  queryKey: [...WORKSPACES_KEY, "options"],
  queryFn: () => fetchWorkspaces(),
  select: (data) => data.workspaces,
});

export function workspacesListQueryOptions(params: WorkspaceListParams) {
  return queryOptions({
    queryKey: [...WORKSPACES_KEY, "list", params],
    queryFn: () => fetchWorkspaces(params),
  });
}

export function workspacesDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...WORKSPACES_KEY, id],
    queryFn: () => fetchWorkspace(id),
    enabled: Boolean(id),
  });
}

export function useWorkspacesQuery() {
  return useQuery(workspacesQueryOptions);
}

export function useWorkspacesListQuery(params: WorkspaceListParams) {
  return useQuery(workspacesListQueryOptions(params));
}

export function useWorkspaceDetailQuery(id: string) {
  return useQuery(workspacesDetailQueryOptions(id));
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
    },
  });
}

export function useUpdateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWorkspaceInput }) =>
      updateWorkspace(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
    },
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
    },
  });
}
