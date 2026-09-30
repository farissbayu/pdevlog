import {
  AlertTriangle,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";

import { useDeleteWorkspaceMutation, useWorkspacesQuery } from "./api";
import { WorkspaceFormDialog } from "./workspace-form-dialog";
import { WorkspaceTypeBadge } from "./workspace-type-badge";

function WorkspaceListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border bg-card p-5"
        >
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FolderPlus className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Create your first workspace</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Workspaces group your brag logs and learning notes. Start with a work
          project or a learning track.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        New workspace
      </Button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Failed to load workspaces</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading your workspaces.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function WorkspacesPage() {
  const { data, isPending, isError, refetch } = useWorkspacesQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceResponse | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceResponse | null>(null);
  const deleteMutation = useDeleteWorkspaceMutation();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (workspace: WorkspaceResponse) => {
    setEditing(workspace);
    setFormOpen(true);
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
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Manage the workspaces that group your logs and notes.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New workspace
        </Button>
      </div>

      {isPending ? <WorkspaceListSkeleton /> : null}

      {isError ? <ErrorState onRetry={() => void refetch()} /> : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((workspace) => (
            <div
              key={workspace.id}
              className="group flex flex-col gap-3 rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate font-medium">{workspace.name}</h2>
                  <WorkspaceTypeBadge type={workspace.type} />
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${workspace.name}`}
                    onClick={() => openEdit(workspace)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${workspace.name}`}
                    onClick={() => setDeleting(workspace)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                {workspace.description || "No description"}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <WorkspaceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        workspace={editing}
      />

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
            <DialogTitle>Delete workspace</DialogTitle>
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
