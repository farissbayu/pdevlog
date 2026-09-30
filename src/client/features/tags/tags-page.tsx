import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "cn";

import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import type { TagResponse } from "@/shared/schemas/tag";

import {
  useCreateTagMutation,
  useDeleteTagMutation,
  useTagsQuery,
  useUpdateTagMutation,
} from "./api";

function TagListSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[64, 88, 72, 104, 56].map((width, index) => (
        <div
          key={index}
          className="h-8 animate-pulse rounded-full bg-muted"
          style={{ width }}
        />
      ))}
    </div>
  );
}

function validateName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Tag name is required";
  }
  if (trimmed.length > 50) {
    return "Tag name must be 50 characters or less";
  }
  return null;
}

export function TagsPage() {
  const { data, isPending, isError, refetch } = useTagsQuery();
  const createMutation = useCreateTagMutation();
  const updateMutation = useUpdateTagMutation();
  const deleteMutation = useDeleteTagMutation();

  const [newName, setNewName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TagResponse | null>(null);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateName(newName);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    createMutation.mutate(
      { name: newName.trim() },
      {
        onSuccess: () => setNewName(""),
        onError: (error) => setFormError(error.message),
      },
    );
  };

  const startEdit = (tag: TagResponse) => {
    setEditingId(tag.id);
    setEditingName(tag.name);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditError(null);
  };

  const submitEdit = (tag: TagResponse) => {
    const validationError = validateName(editingName);
    if (validationError) {
      setEditError(validationError);
      return;
    }
    setEditError(null);
    updateMutation.mutate(
      { id: tag.id, input: { name: editingName.trim() } },
      {
        onSuccess: () => cancelEdit(),
        onError: (error) => setEditError(error.message),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) {
      return;
    }
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => setDeleting(null),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="text-sm text-muted-foreground">
          Reusable labels for technologies you work with.
        </p>
      </div>

      <form className="space-y-2" onSubmit={handleCreate}>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Add a tag, e.g. Next.js"
            maxLength={50}
            aria-label="New tag name"
            className="max-w-xs"
          />
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </div>
        {formError ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : null}
      </form>

      {isPending ? <TagListSkeleton /> : null}

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Failed to load tags</h2>
            <p className="text-sm text-muted-foreground">
              Something went wrong while loading your tags.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <TagIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No tags yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your first tag to start labeling the technologies in your
              logs.
            </p>
          </div>
        </div>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.map((tag) => {
            const isEditing = editingId === tag.id;
            return (
              <li
                key={tag.id}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
              >
                {isEditing ? (
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingName}
                        onChange={(event) =>
                          setEditingName(event.target.value)
                        }
                        maxLength={50}
                        autoFocus
                        aria-label={`Rename ${tag.name}`}
                        className="h-8 max-w-xs"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitEdit(tag);
                          }
                          if (event.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                      />
                      <Button
                        size="icon-sm"
                        aria-label="Save tag"
                        disabled={updateMutation.isPending}
                        onClick={() => submitEdit(tag)}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Cancel edit"
                        onClick={cancelEdit}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    {editError ? (
                      <p className="text-xs text-destructive">{editError}</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <span
                      className={cn(
                        "flex-1 truncate text-sm font-medium",
                      )}
                    >
                      {tag.name}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit ${tag.name}`}
                      onClick={() => startEdit(tag)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${tag.name}`}
                      onClick={() => setDeleting(tag)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleting?.name}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
