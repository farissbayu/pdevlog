import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type { PaginationMeta } from "@/shared/schemas/pagination";
import type {
  CreateProjectInput,
  CreateProjectItemInput,
  ProjectDetailResponse,
  ProjectItemDetailResponse,
  ProjectItemListResponse,
  ProjectItemResponse,
  ProjectListResponse,
  ProjectResponse,
  ShipProjectItemInput,
  UpdateProjectInput,
  UpdateProjectItemInput,
} from "@/shared/schemas/project";

const PROJECTS_KEY = ["projects"] as const;

export type ProjectFilters = {
  workspaceId?: string;
  q?: string;
  page?: number;
};

export type ProjectListResult = {
  projects: ProjectResponse[];
  pagination: PaginationMeta;
};

export async function fetchProjects(
  filters?: string | ProjectFilters,
): Promise<ProjectListResult> {
  const query: {
    workspace_id?: string;
    q?: string;
    page?: string;
  } = {};

  if (typeof filters === "string") {
    if (filters) query.workspace_id = filters;
  } else if (filters) {
    if (filters.workspaceId) query.workspace_id = filters.workspaceId;
    const trimmed = filters.q?.trim();
    if (trimmed) query.q = trimmed;
    if (filters.page) query.page = String(filters.page);
  }

  const response = await client.api.projects.$get({
    query,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load projects");
  }
  const data = (await response.json()) as ProjectListResponse;
  return { projects: data.projects, pagination: data.pagination };
}

export async function fetchProject(id: string): Promise<ProjectResponse> {
  const response = await client.api.projects[":id"].$get({ param: { id } });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load project");
  }
  const data = (await response.json()) as ProjectDetailResponse;
  return data.project;
}

export async function fetchProjectItems(
  projectId: string,
): Promise<ProjectItemResponse[]> {
  const response = await client.api.projects[":id"].items.$get({
    param: { id: projectId },
    query: {},
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load project items");
  }
  const data = (await response.json()) as ProjectItemListResponse;
  return data.items;
}

export async function fetchChangelogMarkdown(
  projectId: string,
): Promise<string> {
  const response = await client.api.projects[":id"].changelog.export.$get({
    param: { id: projectId },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to export changelog");
  }
  return response.text();
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectResponse> {
  const response = await client.api.projects.$post({ json: input });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to create project");
  }
  const data = (await response.json()) as ProjectDetailResponse;
  return data.project;
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<ProjectResponse> {
  const response = await client.api.projects[":id"].$put({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update project");
  }
  const data = (await response.json()) as ProjectDetailResponse;
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  const response = await client.api.projects[":id"].$delete({ param: { id } });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete project");
  }
}

export async function createProjectItem(
  projectId: string,
  input: CreateProjectItemInput,
): Promise<ProjectItemResponse> {
  const response = await client.api.projects[":id"].items.$post({
    param: { id: projectId },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to add item");
  }
  const data = (await response.json()) as ProjectItemDetailResponse;
  return data.item;
}

export async function updateProjectItem(
  projectId: string,
  itemId: string,
  input: UpdateProjectItemInput,
): Promise<ProjectItemResponse> {
  const response = await client.api.projects[":id"].items[":itemId"].$put({
    param: { id: projectId, itemId },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update item");
  }
  const data = (await response.json()) as ProjectItemDetailResponse;
  return data.item;
}

export async function shipProjectItem(
  projectId: string,
  itemId: string,
  input: ShipProjectItemInput = {},
): Promise<ProjectItemResponse> {
  const response = await client.api.projects[":id"].items[":itemId"].ship.$post({
    param: { id: projectId, itemId },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to ship item");
  }
  const data = (await response.json()) as ProjectItemDetailResponse;
  return data.item;
}

export async function deleteProjectItem(
  projectId: string,
  itemId: string,
): Promise<void> {
  const response = await client.api.projects[":id"].items[":itemId"].$delete({
    param: { id: projectId, itemId },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete item");
  }
}

export function projectsQueryOptions(
  filters: string | ProjectFilters = {},
) {
  const filterObj =
    typeof filters === "string" ? { workspaceId: filters } : filters;
  const enabled =
    typeof filters === "string"
      ? Boolean(filters)
      : filterObj.workspaceId === undefined || Boolean(filterObj.workspaceId);

  return queryOptions({
    queryKey: [...PROJECTS_KEY, "list", filterObj],
    queryFn: () => fetchProjects(filters),
    enabled,
  });
}

export function projectDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...PROJECTS_KEY, id],
    queryFn: () => fetchProject(id),
    enabled: Boolean(id),
  });
}

export function projectItemsQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: [...PROJECTS_KEY, projectId, "items"],
    queryFn: () => fetchProjectItems(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectsQuery(filters: string | ProjectFilters) {
  return useQuery(projectsQueryOptions(filters));
}

export function useAllProjectsQuery() {
  return useQuery({
    queryKey: [...PROJECTS_KEY, "list", "all"],
    queryFn: () => fetchProjects(),
  });
}

export function useProjectDetailQuery(id: string) {
  return useQuery(projectDetailQueryOptions(id));
}

export function useProjectItemsQuery(projectId: string) {
  return useQuery(projectItemsQueryOptions(projectId));
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      updateProject(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useCreateProjectItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: CreateProjectItemInput;
    }) => createProjectItem(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["sparks"] });
    },
  });
}

export function useUpdateProjectItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      itemId,
      input,
    }: {
      projectId: string;
      itemId: string;
      input: UpdateProjectItemInput;
    }) => updateProjectItem(projectId, itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useShipProjectItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      itemId,
      version,
    }: {
      projectId: string;
      itemId: string;
      version?: string;
    }) => shipProjectItem(projectId, itemId, { version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useDeleteProjectItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      itemId,
    }: {
      projectId: string;
      itemId: string;
    }) => deleteProjectItem(projectId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}
