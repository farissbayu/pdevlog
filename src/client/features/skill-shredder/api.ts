import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  CreateSkillShredInput,
  SkillShredDetailResponse,
  SkillShredListResponse,
  SkillShredNoteResponse,
  SkillShredResponse,
  UpdateSkillProgressInput,
} from "@/shared/schemas/skill-shredder";

const SKILL_KEY = ["skill-shredder"] as const;
const POLL_INTERVAL_MS = 2500;

function isGenerating(shred: SkillShredResponse | undefined): boolean {
  return shred?.status === "generating";
}

export async function createSkillShred(
  input: CreateSkillShredInput,
): Promise<SkillShredResponse> {
  const response = await client.api["skill-shredder"].$post({ json: input });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to save the skill shred");
  }
  const data = (await response.json()) as SkillShredDetailResponse;
  return data.shred;
}

export async function fetchSkillShreds(
  noteId?: string,
): Promise<SkillShredResponse[]> {
  const response = await client.api["skill-shredder"].$get({
    query: noteId ? { note_id: noteId } : {},
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load skill shreds");
  }
  const data = (await response.json()) as SkillShredListResponse;
  return data.shreds;
}

export async function fetchSkillShred(
  id: string,
): Promise<SkillShredResponse> {
  const response = await client.api["skill-shredder"][":id"].$get({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load the skill shred");
  }
  const data = (await response.json()) as SkillShredDetailResponse;
  return data.shred;
}

export async function updateSkillProgress(
  id: string,
  input: UpdateSkillProgressInput,
): Promise<SkillShredResponse> {
  const response = await client.api["skill-shredder"][":id"].progress.$patch({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update progress");
  }
  const data = (await response.json()) as SkillShredDetailResponse;
  return data.shred;
}

export async function exportSkillToNote(
  id: string,
  mode: "new" | "append" = "new",
): Promise<SkillShredNoteResponse> {
  const response = await client.api["skill-shredder"][":id"].note.$post({
    param: { id },
    query: { mode },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to export to a note");
  }
  return (await response.json()) as SkillShredNoteResponse;
}

export async function retrySkillShred(id: string): Promise<SkillShredResponse> {
  const response = await client.api["skill-shredder"][":id"].retry.$post({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to retry generation");
  }
  const data = (await response.json()) as SkillShredDetailResponse;
  return data.shred;
}

export async function deleteSkillShred(id: string): Promise<void> {
  const response = await client.api["skill-shredder"][":id"].$delete({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete the skill shred");
  }
}

export const skillShredsQueryOptions = (noteId?: string) =>
  queryOptions({
    queryKey: [...SKILL_KEY, "list", noteId ?? "all"],
    queryFn: () => fetchSkillShreds(noteId),
    refetchInterval: (query) =>
      query.state.data?.some(isGenerating) ? POLL_INTERVAL_MS : false,
  });

export const skillShredQueryOptions = (id: string) =>
  queryOptions({
    queryKey: [...SKILL_KEY, "detail", id],
    queryFn: () => fetchSkillShred(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      isGenerating(query.state.data) ? POLL_INTERVAL_MS : false,
  });

export function useSkillShredsQuery(noteId?: string) {
  return useQuery(skillShredsQueryOptions(noteId));
}

export function useSkillShredQuery(id: string) {
  return useQuery(skillShredQueryOptions(id));
}

export function useCreateSkillShredMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSkillShred,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SKILL_KEY });
    },
  });
}

export function useRetrySkillShredMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retrySkillShred,
    onSuccess: (shred) => {
      queryClient.setQueryData([...SKILL_KEY, "detail", shred.id], shred);
      queryClient.invalidateQueries({ queryKey: SKILL_KEY });
    },
  });
}

export function useUpdateSkillProgressMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateSkillProgressInput;
    }) => updateSkillProgress(id, input),
    onSuccess: (shred) => {
      queryClient.invalidateQueries({ queryKey: SKILL_KEY });
      queryClient.setQueryData([...SKILL_KEY, "detail", shred.id], shred);
    },
  });
}

export function useExportSkillNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode?: "new" | "append" }) =>
      exportSkillToNote(id, mode),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SKILL_KEY });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.setQueryData([...SKILL_KEY, "detail", data.shred.id], data.shred);
    },
  });
}

export function useDeleteSkillShredMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSkillShred,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SKILL_KEY });
    },
  });
}
