import {
  Archive,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "cn";

import { AutoResizeTextarea } from "@/client/components/ui/auto-resize-textarea";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Label } from "@/client/components/ui/label";
import { MultiSelect } from "@/client/components/ui/multi-select";
import { useTagsQuery } from "@/client/features/tags/api";
import {
  MAX_STORAGE_PER_OWNER,
  type AttachmentResponse,
} from "@/shared/schemas/attachment";
import {
  createSparkSchema,
  updateSparkSchema,
  type SparkResponse,
} from "@/shared/schemas/spark";

import {
  useCreateSparkMutation,
  useDeleteAttachmentMutation,
  useUpdateSparkMutation,
  useUploadSparkAttachmentMutation,
} from "./api";
import {
  extractImageFiles,
  formatBytes,
  useFilePreviews,
  validateImageFile,
} from "@/client/lib/attachments";

type SparkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spark?: SparkResponse | null;
  initialContent?: string;
  mode?: "capture" | "recall";
};

export function SparkDialog({
  open,
  onOpenChange,
  spark,
  initialContent = "",
  mode = "capture",
}: SparkDialogProps) {
  const isEditing = Boolean(spark);
  const createMutation = useCreateSparkMutation();
  const updateMutation = useUpdateSparkMutation();
  const uploadMutation = useUploadSparkAttachmentMutation();
  const deleteAttachmentMutation = useDeleteAttachmentMutation();
  const mutation = isEditing ? updateMutation : createMutation;
  const { data: tags } = useTagsQuery();

  const [content, setContent] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<AttachmentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useFilePreviews(files);
  const totalCount = existing.length + files.length;

  useEffect(() => {
    if (!open) {
      return;
    }
    setContent(spark?.content ?? initialContent);
    setTagIds(spark?.tags.map((tag) => tag.id) ?? []);
    setExisting(spark?.attachments ?? []);
    setFiles([]);
    setError(null);
    setUploading(false);
  }, [open, spark, initialContent]);

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) {
      return;
    }
    setError(null);
    setFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        const message = validateImageFile(file, existing.length + next.length);
        if (message) {
          setError(message);
          continue;
        }
        next.push(file);
      }
      return next;
    });
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = extractImageFiles(event.clipboardData);
    if (pasted.length > 0) {
      event.preventDefault();
      addFiles(pasted);
    }
  };

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    addFiles(extractImageFiles(event.dataTransfer));
  };

  const uploadPending = async (sparkId: string) => {
    if (files.length === 0) {
      return;
    }
    setUploading(true);
    for (const file of files) {
      await uploadMutation.mutateAsync({ sparkId, file });
    }
    setUploading(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmed = content.trim();
    if (!trimmed && totalCount === 0) {
      setError("Add something to your spark first");
      return;
    }

    if (isEditing && spark) {
      const parsed = updateSparkSchema.safeParse({
        ...(trimmed ? { content: trimmed } : {}),
        tag_ids: tagIds,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      updateMutation.mutate(
        { id: spark.id, input: parsed.data },
        {
          onSuccess: async () => {
            try {
              await uploadPending(spark.id);
              onOpenChange(false);
            } catch (uploadError) {
              setError((uploadError as Error).message);
              onOpenChange(false);
            }
          },
          onError: (mutationError) => setError(mutationError.message),
        },
      );
      return;
    }

    const parsed = createSparkSchema.safeParse({
      content: trimmed,
      tag_ids: tagIds,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    createMutation.mutate(parsed.data, {
      onSuccess: async (created) => {
        try {
          await uploadPending(created.id);
          onOpenChange(false);
        } catch (uploadError) {
          setError((uploadError as Error).message);
          onOpenChange(false);
        }
      },
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  const handleArchiveToggle = () => {
    if (!spark) {
      return;
    }
    updateMutation.mutate(
      {
        id: spark.id,
        input: { status: spark.status === "open" ? "archived" : "open" },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const busy = mutation.isPending || uploading;

  const title = isEditing
    ? "Edit spark"
    : mode === "recall"
      ? "A spark from the past"
      : "Capture a spark";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Dump anything — a link, an idea, a screenshot. It stays in your
            inbox until you act on it.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={handleSubmit}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <div className="space-y-2">
            <Label htmlFor="spark-content" className="sr-only">
              Spark
            </Label>
            <AutoResizeTextarea
              id="spark-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="https://x.com/... or “I want to try building X with Y” — screenshots welcome"
              className="min-h-28 text-sm"
              maxLength={10000}
              autoFocus
            />
          </div>

          {existing.length > 0 || previews.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {existing.map((attachment) => (
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
                    onClick={() => {
                      setExisting((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      );
                      deleteAttachmentMutation.mutate(attachment.id);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {previews.map((preview, index) => (
                <div
                  key={preview.url}
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
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

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
              {formatBytes(10 * 1024 * 1024)}
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

          <div className="space-y-2">
            <Label htmlFor="spark-tags">Tags (optional)</Label>
            {tags && tags.length > 0 ? (
              <MultiSelect
                id="spark-tags"
                aria-label="Tags"
                options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
                value={tagIds}
                onChange={setTagIds}
                placeholder="Select tags"
                searchPlaceholder="Search tags..."
                emptyMessage="No tag found."
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No tags yet. You can add tags later.
              </p>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {isEditing && spark ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={handleArchiveToggle}
              >
                <Archive className="size-4" />
                {spark.status === "open" ? "Archive" : "Reopen"}
              </Button>
            ) : (
              <span className="hidden text-xs text-muted-foreground sm:block">
                ⌘/Ctrl + Enter to save · paste to attach
              </span>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {uploading ? "Uploading…" : isEditing ? "Save" : "Spark it"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
