import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  ImagePlus,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { cn } from "cn";
import { toast } from "sonner";

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
import {
  extractImageFiles,
  formatBytes,
  uploadAttachment,
  useFilePreviews,
  validateImageFile,
} from "@/client/lib/attachments";
import {
  SourceEditor,
  normalizeSourceDrafts,
  sourceDraftsFromResponse,
  type SourceDraft,
} from "@/client/features/sources/source-editor";
import { useTagsQuery } from "@/client/features/tags/api";
import { useWorkspacesQuery } from "@/client/features/workspaces/api";
import {
  MAX_ATTACHMENT_SIZE,
  MAX_STORAGE_PER_OWNER,
  type AttachmentResponse,
} from "@/shared/schemas/attachment";
import {
  createNoteSchema,
  updateNoteSchema,
  type NoteResponse,
} from "@/shared/schemas/notes";
import { sparkTitle, type SparkResponse } from "@/shared/schemas/spark";

import {
  useCreateNoteMutation,
  useNoteDetailQuery,
  useUpdateNoteMutation,
} from "./api";
import { useSparkDetailQuery } from "@/client/features/sparks/api";

type EditorMode = "edit" | "preview";

const PENDING_PREFIX = "/__pending__/";

type PendingFile = {
  id: string;
  file: File;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeMarkdownImage(content: string, target: string): string {
  const pattern = new RegExp(
    `!\\[[^\\]]*\\]\\(${escapeRegExp(target)}\\)`,
    "g",
  );
  return content
    .replace(pattern, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function firstUrlInText(content: string): string | null {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) {
    return null;
  }
  const match = firstLine.match(/^https?:\/\/\S+$/i);
  return match ? match[0] : null;
}

function initialContent(
  note: NoteResponse | null,
  spark: SparkResponse | null | undefined,
): string {
  if (note) {
    return note.content;
  }
  if (!spark) {
    return "";
  }
  const embeds = (spark.attachments ?? [])
    .map((attachment) => `![image](${attachment.url})`)
    .join("\n\n");
  return embeds ? `${spark.content}\n\n${embeds}` : spark.content;
}

function initialSources(
  note: NoteResponse | null,
  spark: SparkResponse | null | undefined,
): SourceDraft[] {
  if (note) {
    return sourceDraftsFromResponse(note.sources);
  }
  const sparkUrl = spark ? firstUrlInText(spark.content) : null;
  return sparkUrl
    ? [{ url: sparkUrl, label: "", kind: "", locator: "" }]
    : [];
}

function NoteEditorForm({
  note,
  presetWorkspaceId,
  spark,
}: {
  note: NoteResponse | null;
  presetWorkspaceId: string;
  spark?: SparkResponse | null;
}) {
  const isEditing = Boolean(note);
  const navigate = useNavigate();
  const createMutation = useCreateNoteMutation();
  const updateMutation = useUpdateNoteMutation();

  const { data: workspaces } = useWorkspacesQuery();
  const { data: tags } = useTagsQuery();

  const [title, setTitle] = useState(
    note?.title ?? (spark ? sparkTitle(spark.content) : ""),
  );
  const [content, setContent] = useState(() => initialContent(note, spark));
  const [workspaceId, setWorkspaceId] = useState(
    note?.workspaceId ?? presetWorkspaceId ?? "",
  );
  const [tagIds, setTagIds] = useState<string[]>(
    note?.tags.map((tag) => tag.id) ??
      spark?.tags.map((tag) => tag.id) ??
      [],
  );
  const [sources, setSources] = useState<SourceDraft[]>(() =>
    initialSources(note, spark),
  );
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingFiles = useMemo(
    () => pending.map((item) => item.file),
    [pending],
  );
  const previews = useFilePreviews(pendingFiles);

  const pendingUrls = useMemo(() => {
    const map = new Map<string, string>();
    pending.forEach((item, index) => {
      const preview = previews[index];
      if (preview) {
        map.set(item.id, preview.url);
      }
    });
    return map;
  }, [pending, previews]);

  const resolveImageSrc = useCallback(
    (src: string) => {
      if (src.startsWith(PENDING_PREFIX)) {
        return pendingUrls.get(src.slice(PENDING_PREFIX.length)) ?? src;
      }
      return src;
    },
    [pendingUrls],
  );

  const visibleAttachments = (note?.attachments ?? []).filter(
    (attachment) => !removedIds.includes(attachment.id),
  );
  const totalCount = visibleAttachments.length + pending.length;

  const backTo =
    isEditing && note
      ? `/notes/${note.id}`
      : spark
        ? "/sparks"
        : presetWorkspaceId
          ? `/workspaces/${presetWorkspaceId}`
          : "/workspaces";

  const insertAtCursor = (snippet: string) => {
    const textarea = contentRef.current;
    const start = textarea?.selectionStart ?? null;
    const end = textarea?.selectionEnd ?? null;
    setContent((current) => {
      if (start === null || end === null) {
        return current.length > 0 ? `${current}\n${snippet}` : snippet;
      }
      return `${current.slice(0, start)}${snippet}${current.slice(end)}`;
    });
    if (textarea && start !== null) {
      requestAnimationFrame(() => {
        textarea.focus();
        const position = start + snippet.length;
        textarea.setSelectionRange(position, position);
      });
    }
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) {
      return;
    }
    setError(null);
    const accepted: PendingFile[] = [];
    let count = totalCount;
    let validationError: string | null = null;
    for (const file of incoming) {
      const message = validateImageFile(file, count);
      if (message) {
        validationError = message;
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file });
      count += 1;
    }
    if (accepted.length > 0) {
      setPending((current) => [...current, ...accepted]);
      insertAtCursor(
        accepted
          .map((item) => `![image](${PENDING_PREFIX}${item.id})`)
          .join("\n\n"),
      );
    }
    if (validationError) {
      setError(validationError);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLElement>) => {
    const pasted = extractImageFiles(event.clipboardData);
    if (pasted.length > 0) {
      event.preventDefault();
      addFiles(pasted);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const dropped = extractImageFiles(event.dataTransfer);
    if (dropped.length > 0) {
      event.preventDefault();
      addFiles(dropped);
    }
  };

  const removePending = (item: PendingFile) => {
    setPending((current) => current.filter((entry) => entry.id !== item.id));
    setContent((current) =>
      removeMarkdownImage(current, `${PENDING_PREFIX}${item.id}`),
    );
  };

  const removeExisting = (attachment: AttachmentResponse) => {
    setRemovedIds((current) => [...current, attachment.id]);
    setContent((current) => removeMarkdownImage(current, attachment.url));
  };

  const persistPending = async (noteId: string): Promise<string> => {
    if (pending.length === 0) {
      return content;
    }
    setUploading(true);
    try {
      let next = content;
      for (const item of pending) {
        const attachment = await uploadAttachment("notes", noteId, item.file);
        next = next
          .split(`${PENDING_PREFIX}${item.id}`)
          .join(attachment.url);
      }
      setContent(next);
      setPending([]);
      return next;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading || createMutation.isPending || updateMutation.isPending) {
      return;
    }
    setError(null);

    const payload = {
      title: title.trim(),
      content,
      workspace_id: workspaceId || null,
      tag_ids: tagIds,
      sources: normalizeSourceDrafts(sources),
      ...(spark && !note ? { spark_id: spark.id } : {}),
    };

    const onError = (mutationError: Error) =>
      setError(mutationError.message);
    const persistedId = note?.id ?? savedNoteId;

    if (persistedId) {
      const parsed = updateNoteSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      try {
        const finalContent = await persistPending(persistedId);
        updateMutation.mutate(
          { id: persistedId, input: { ...parsed.data, content: finalContent } },
          {
            onSuccess: () => {
              navigate(`/notes/${persistedId}`);
              toast.success("Note saved");
            },
            onError,
          },
        );
      } catch (uploadError) {
        setError((uploadError as Error).message);
      }
      return;
    }

    const parsed = createNoteSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    createMutation.mutate(parsed.data, {
      onSuccess: async (saved) => {
        setSavedNoteId(saved.id);
        try {
          const finalContent = await persistPending(saved.id);
          if (finalContent !== parsed.data.content) {
            updateMutation.mutate(
              { id: saved.id, input: { content: finalContent } },
              {
                onSuccess: () => {
                  navigate(`/notes/${saved.id}`);
                  toast.success("Note created");
                },
                onError,
              },
            );
            return;
          }
          navigate(`/notes/${saved.id}`);
          toast.success("Note created");
        } catch (uploadError) {
          setError((uploadError as Error).message);
        }
      },
      onError,
    });
  };

  const busy = uploading || createMutation.isPending || updateMutation.isPending;

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
          <Button type="submit" form="note-form" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {uploading
              ? "Uploading\u2026"
              : isEditing
                ? "Save changes"
                : "Create note"}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {isEditing ? "Edit note" : spark ? "Turn spark into a note" : "New note"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {spark
            ? "Your spark is pre-filled below. Flesh it out, then save it as a note."
            : "Write in Markdown and toggle the preview to see the rendered result."}
        </p>
      </div>

      <form
        id="note-form"
        className="space-y-5"
        onSubmit={handleSubmit}
        onPaste={handlePaste}
      >
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
                {(workspaces ?? []).map((workspace) => (
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

        <SourceEditor
          sources={sources}
          onChange={setSources}
          emptyHint="No sources yet. Add links, books, or courses related to this note."
        />

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

          {visibleAttachments.length > 0 || previews.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group relative size-20 overflow-hidden rounded-md border"
                >
                  <img
                    src={attachment.url}
                    alt="Attachment"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove image"
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeExisting(attachment)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {pending.map((item, index) => {
                const preview = previews[index];
                if (!preview) {
                  return null;
                }
                return (
                  <div
                    key={item.id}
                    className="group relative size-20 overflow-hidden rounded-md border"
                  >
                    <img
                      src={preview.url}
                      alt="Pending attachment"
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => removePending(item)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {mode === "edit" ? (
            <div onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
              <AutoResizeTextarea
                id="note-content"
                ref={contentRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={"# Heading\n\nWrite Markdown here..."}
                className="min-h-[28rem] font-mono text-sm"
              />
            </div>
          ) : (
            <div className="min-h-[28rem] rounded-md border bg-card p-5">
              {content.trim() ? (
                <MarkdownRenderer
                  content={content}
                  resolveImageSrc={resolveImageSrc}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={totalCount >= MAX_STORAGE_PER_OWNER}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              Add image
            </Button>
            <span
              className={cn(
                "text-xs text-muted-foreground",
                totalCount >= MAX_STORAGE_PER_OWNER && "text-destructive",
              )}
            >
              {totalCount}/{MAX_STORAGE_PER_OWNER} images · max{" "}
              {formatBytes(MAX_ATTACHMENT_SIZE)}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </div>
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
  const sparkId = searchParams.get("spark") ?? "";
  const isEditing = Boolean(id);
  const noteQuery = useNoteDetailQuery(id ?? "");
  const sparkQuery = useSparkDetailQuery(isEditing ? "" : sparkId);
  const spark = sparkId ? (sparkQuery.data ?? null) : null;

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

  if (!isEditing && sparkId && sparkQuery.isPending) {
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

  return (
    <NoteEditorForm
      key={noteQuery.data?.id ?? spark?.id ?? "new"}
      note={noteQuery.data ?? null}
      presetWorkspaceId={presetWorkspaceId}
      spark={spark}
    />
  );
}
