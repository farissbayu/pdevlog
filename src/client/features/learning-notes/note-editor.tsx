import { AlertTriangle, ArrowLeft, Eye, Loader2, Pencil, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { cn } from "cn";

import { MarkdownRenderer } from "@/client/components/markdown-renderer";
import { AutoResizeTextarea } from "@/client/components/ui/auto-resize-textarea";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { MultiSelect } from "@/client/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { useTagsQuery } from "@/client/features/tags/api";
import { useWorkspacesQuery } from "@/client/features/workspaces/api";
import {
  createLearningNoteSchema,
  updateLearningNoteSchema,
  type LearningNoteResponse,
} from "@/shared/schemas/learning-note";

import {
  useCreateLearningNoteMutation,
  useLearningNoteDetailQuery,
  useUpdateLearningNoteMutation,
} from "./api";

type EditorMode = "edit" | "preview";

function NoteEditorForm({
  note,
  presetWorkspaceId,
}: {
  note: LearningNoteResponse | null;
  presetWorkspaceId: string;
}) {
  const isEditing = Boolean(note);
  const navigate = useNavigate();
  const createMutation = useCreateLearningNoteMutation();
  const updateMutation = useUpdateLearningNoteMutation();
  const mutation = isEditing ? updateMutation : createMutation;

  const { data: workspaces } = useWorkspacesQuery();
  const { data: tags } = useTagsQuery();

  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [workspaceId, setWorkspaceId] = useState(
    note?.workspaceId ?? presetWorkspaceId ?? "",
  );
  const [tagIds, setTagIds] = useState<string[]>(
    note?.tags.map((tag) => tag.id) ?? [],
  );
  const [mode, setMode] = useState<EditorMode>("edit");
  const [error, setError] = useState<string | null>(null);

  const backTo =
    isEditing && note
      ? `/learning-notes/${note.id}`
      : presetWorkspaceId
        ? `/workspaces/${presetWorkspaceId}`
        : "/workspaces";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload = {
      title: title.trim(),
      content,
      workspace_id: workspaceId || null,
      tag_ids: tagIds,
    };

    const onSuccess = (saved: LearningNoteResponse) => {
      navigate(`/learning-notes/${saved.id}`);
    };
    const onError = (mutationError: Error) => setError(mutationError.message);

    if (isEditing && note) {
      const parsed = updateLearningNoteSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      updateMutation.mutate(
        { id: note.id, input: parsed.data },
        { onSuccess, onError },
      );
      return;
    }

    const parsed = createLearningNoteSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    createMutation.mutate(parsed.data, { onSuccess, onError });
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-20 -mx-6 -mt-6 flex flex-wrap items-center justify-between gap-4 border-b bg-background/95 px-6 py-3 backdrop-blur md:top-0">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to={backTo}>Cancel</Link>
          </Button>
          <Button type="submit" form="note-form" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isEditing ? "Save changes" : "Create note"}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {isEditing ? "Edit note" : "New note"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Write in Markdown and toggle the preview to see the rendered result.
        </p>
      </div>

      <form id="note-form" className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="note-title">Title</Label>
          <Input
            id="note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Understanding Cloudflare D1"
            maxLength={200}
            className="h-11 text-base"
            autoFocus
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="note-workspace">Workspace</Label>
            <Select
              value={workspaceId || "none"}
              onValueChange={(value) =>
                setWorkspaceId(value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="note-workspace" className="w-full">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No workspace</SelectItem>
                {(workspaces ?? [])
                  .filter(
                    (workspace) =>
                      workspace.type === "learning" ||
                      workspace.id === workspaceId,
                  )
                  .map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-tags">Tags</Label>
            {tags && tags.length > 0 ? (
              <MultiSelect
                id="note-tags"
                aria-label="Tags"
                options={tags.map((tag) => ({
                  value: tag.id,
                  label: tag.name,
                }))}
                value={tagIds}
                onChange={setTagIds}
                placeholder="Select tags"
                searchPlaceholder="Search tags..."
                emptyMessage="No tag found."
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No tags yet. Create tags to label this note.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="note-content">Content</Label>
            <div className="inline-flex rounded-md border p-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-pressed={mode === "edit"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === "edit"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Pencil className="size-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                aria-pressed={mode === "preview"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === "preview"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Eye className="size-3.5" />
                Preview
              </button>
            </div>
          </div>

          {mode === "edit" ? (
            <AutoResizeTextarea
              id="note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={"# Heading\n\nWrite Markdown here..."}
              className="min-h-[28rem] font-mono text-sm"
            />
          ) : (
            <div className="min-h-[28rem] rounded-md border bg-card p-5">
              {content.trim() ? (
                <MarkdownRenderer content={content} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </div>
  );
}

export function NoteEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const presetWorkspaceId = searchParams.get("workspace") ?? "";
  const isEditing = Boolean(id);
  const noteQuery = useLearningNoteDetailQuery(id ?? "");

  if (isEditing) {
    if (noteQuery.isPending) {
      return (
        <div className="space-y-6">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-11 animate-pulse rounded bg-muted" />
          <div className="h-9 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        </div>
      );
    }

    if (noteQuery.isError || !noteQuery.data) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Note not found</h2>
            <p className="text-sm text-muted-foreground">
              This note may have been deleted or you do not have access to it.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void noteQuery.refetch()}>
              Try again
            </Button>
            <Button asChild>
              <Link to="/workspaces">Back to workspaces</Link>
            </Button>
          </div>
        </div>
      );
    }
  }

  return (
    <NoteEditorForm
      key={noteQuery.data?.id ?? "new"}
      note={noteQuery.data ?? null}
      presetWorkspaceId={presetWorkspaceId}
    />
  );
}
