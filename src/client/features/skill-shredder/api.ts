import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  CreateSkillShredInput,
  SkillShredderInput,
  SkillShredderResponse,
  SkillShredderResult,
  SkillShredDetailResponse,
  SkillShredListResponse,
  SkillShredNoteResponse,
  SkillShredResponse,
  UpdateSkillProgressInput,
} from "@/shared/schemas/skill-shredder";

const SKILL_KEY = ["skill-shredder"] as const;

export async function generateSkillBlueprint(
  input: SkillShredderInput,
): Promise<SkillShredderResult> {
  const response = await client.api["skill-shredder"].generate.$post({
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to shred the topic");
  }
  const data = (await response.json()) as SkillShredderResponse;
  return data.blueprint;
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

export async function fetchSkillShreds(): Promise<SkillShredResponse[]> {
  const response = await client.api["skill-shredder"].$get();
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
): Promise<SkillShredNoteResponse> {
  const response = await client.api["skill-shredder"][":id"].note.$post({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to export to a note");
  }
  return (await response.json()) as SkillShredNoteResponse;
}

export async function deleteSkillShred(id: string): Promise<void> {
  const response = await client.api["skill-shredder"][":id"].$delete({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete the skill shred");
  }
}

export const skillShredsQueryOptions = queryOptions({
  queryKey: [...SKILL_KEY, "list"],
  queryFn: fetchSkillShreds,
});

export const skillShredQueryOptions = (id: string) =>
  queryOptions({
    queryKey: [...SKILL_KEY, "detail", id],
    queryFn: () => fetchSkillShred(id),
    enabled: Boolean(id),
  });

export function useSkillShredsQuery() {
  return useQuery(skillShredsQueryOptions);
}

export function useSkillShredQuery(id: string) {
  return useQuery(skillShredQueryOptions(id));
}

export function useGenerateSkillMutation() {
  return useMutation({ mutationFn: generateSkillBlueprint });
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
    mutationFn: exportSkillToNote,
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
