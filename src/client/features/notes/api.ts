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
  CreateNoteInput,
  NoteDetailResponse,
  NoteListResponse,
  NoteResponse,
  UpdateNoteInput,
} from "@/shared/schemas/notes";
import type { PaginationMeta } from "@/shared/schemas/pagination";

const NOTES_KEY = ["notes"] as const;

export type NoteListResult = {
  notes: NoteResponse[];
  pagination: PaginationMeta;
};

export async function fetchNotes(
  filters: FilterParams,
): Promise<NoteListResult> {
  const response = await client.api.notes.$get({
    query: buildFilterQuery(filters),
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load notes");
  }
  const data = (await response.json()) as NoteListResponse;
  return { notes: data.notes, pagination: data.pagination };
}

export async function fetchNote(
  id: string,
): Promise<NoteResponse> {
  const response = await client.api.notes[":id"].$get({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load note");
  }
  const data = (await response.json()) as NoteDetailResponse;
  return data.note;
}

export async function createNote(
  input: CreateNoteInput,
): Promise<NoteResponse> {
  const response = await client.api.notes.$post({ json: input });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to create note");
  }
  const data = (await response.json()) as NoteDetailResponse;
  return data.note;
}

export async function updateNote(
  id: string,
  input: UpdateNoteInput,
): Promise<NoteResponse> {
  const response = await client.api.notes[":id"].$put({
    param: { id },
    json: input,
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to update note");
  }
  const data = (await response.json()) as NoteDetailResponse;
  return data.note;
}

export async function deleteNote(id: string): Promise<void> {
  const response = await client.api.notes[":id"].$delete({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete note");
  }
}

export function notesQueryOptions(
  filters: FilterParams = EMPTY_FILTERS,
) {
  return queryOptions({
    queryKey: [...NOTES_KEY, filters],
    queryFn: () => fetchNotes(filters),
  });
}

export function noteDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...NOTES_KEY, id],
    queryFn: () => fetchNote(id),
    enabled: Boolean(id),
  });
}

export function useNotesQuery(filters: FilterParams = EMPTY_FILTERS) {
  return useQuery(notesQueryOptions(filters));
}

export function useNoteDetailQuery(id: string) {
  return useQuery(noteDetailQueryOptions(id));
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      queryClient.invalidateQueries({ queryKey: ["sparks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNoteInput }) =>
      updateNote(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      queryClient.invalidateQueries({
        queryKey: [...NOTES_KEY, variables.id],
      });
    },
  });
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    },
  });
}
