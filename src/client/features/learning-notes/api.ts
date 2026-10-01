import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  CreateLearningNoteInput,
  LearningNoteDetailResponse,
  LearningNoteListResponse,
  LearningNoteResponse,
  UpdateLearningNoteInput,
} from "@/shared/schemas/learning-note";

const LEARNING_NOTES_KEY = ["learning-notes"] as const;

export async function fetchLearningNotes(): Promise<LearningNoteResponse[]> {
  const response = await client.api["learning-notes"].$get();
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load learning notes");
  }
  const data = (await response.json()) as LearningNoteListResponse;
  return data.learningNotes;
}

export async function fetchLearningNote(
  id: string,
): Promise<LearningNoteResponse> {
  const response = await client.api["learning-notes"][":id"].$get({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load learning note");
  }
  const data = (await response.json()) as LearningNoteDetailResponse;
  return data.learningNote;
}

export async function createLearningNote(
  input: CreateLearningNoteInput,
): Promise<LearningNoteResponse> {
  const response = await client.api["learning-notes"].$post({ json: input });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to create learning note");
  }
  const data = (await response.json()) as LearningNoteDetailResponse;
  return data.learningNote;
}

export async function updateLearningNote(
  id: string,
  input: UpdateLearningNoteInput,
): Promise<LearningNoteResponse> {
  const response = await client.api["learning-notes"][":id"].$put({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update learning note");
  }
  const data = (await response.json()) as LearningNoteDetailResponse;
  return data.learningNote;
}

export async function deleteLearningNote(id: string): Promise<void> {
  const response = await client.api["learning-notes"][":id"].$delete({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete learning note");
  }
}

export const learningNotesQueryOptions = queryOptions({
  queryKey: LEARNING_NOTES_KEY,
  queryFn: fetchLearningNotes,
});

export function learningNoteDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...LEARNING_NOTES_KEY, id],
    queryFn: () => fetchLearningNote(id),
    enabled: Boolean(id),
  });
}

export function useLearningNotesQuery() {
  return useQuery(learningNotesQueryOptions);
}

export function useLearningNoteDetailQuery(id: string) {
  return useQuery(learningNoteDetailQueryOptions(id));
}

export function useCreateLearningNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLearningNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_NOTES_KEY });
    },
  });
}

export function useUpdateLearningNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLearningNoteInput }) =>
      updateLearningNote(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: LEARNING_NOTES_KEY });
      queryClient.invalidateQueries({
        queryKey: [...LEARNING_NOTES_KEY, variables.id],
      });
    },
  });
}

export function useDeleteLearningNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLearningNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_NOTES_KEY });
    },
  });
}
