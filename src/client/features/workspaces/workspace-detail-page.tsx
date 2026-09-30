import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { useBragLogsQuery, useDeleteBragLogMutation } from "@/client/features/brag-logs/api";
import { BragLogFormDialog } from "@/client/features/brag-logs/brag-log-form";
import {
  BragLogErrorState,
  BragLogList,
  BragLogListSkeleton,
} from "@/client/features/brag-logs/brag-log-list";
import type { BragLogResponse } from "@/shared/schemas/brag-log";

import { useDeleteWorkspaceMutation, useWorkspaceDetailQuery } from "./api";
import { WorkspaceFormDialog } from "./workspace-form-dialog";
import { WorkspaceTypeBadge } from "./workspace-type-badge";

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FileText className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No brag logs yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Record your wins and bug fixes for this workspace using the STAR
          framework.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        New brag log
      </Button>
    </div>
  );
}

export function WorkspaceDetailPage() {
  const { id = "" } = useParams();
  const {
    data: workspace,
    isPending: isWorkspacePending,
    isError: isWorkspaceError,
    refetch: refetchWorkspace,
  } = useWorkspaceDetailQuery(id);
  const {
    data: logs,
    isPending: isLogsPending,
    isError: isLogsError,
    refetch: refetchLogs,
  } = useBragLogsQuery();

  const deleteMutation = useDeleteBragLogMutation();
  const workspaceDeleteMutation = useDeleteWorkspaceMutation();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BragLogResponse | null>(null);
  const [deleting, setDeleting] = useState<BragLogResponse | null>(null);
  const [editWorkspaceOpen, setEditWorkspaceOpen] = useState(false);
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (log: BragLogResponse) => {
    setEditing(log);
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

  const confirmDeleteWorkspace = () => {
    if (!workspace) {
      return;
    }
    workspaceDeleteMutation.mutate(workspace.id, {
      onSuccess: () => navigate("/workspaces"),
    });
  };

  if (isWorkspacePending) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isWorkspaceError || !workspace) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Workspace not found</h2>
          <p className="text-sm text-muted-foreground">
            This workspace may have been deleted or you do not have access to
            it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetchWorkspace()}>
            Try again
          </Button>
          <Button asChild>
            <Link to="/workspaces">Back to workspaces</Link>
          </Button>
        </div>
      </div>
    );
  }

  const workspaceLogs =
    logs?.filter((log) => log.workspaceId === workspace.id) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/workspaces"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Workspaces
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{workspace.name}</h1>
            <WorkspaceTypeBadge type={workspace.type} />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {workspace.description || "No description"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Edit workspace"
            title="Edit workspace"
            onClick={() => setEditWorkspaceOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            aria-label="Delete workspace"
            title="Delete workspace"
            onClick={() => setDeleteWorkspaceOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New brag log
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Brag logs</h2>
        <p className="text-sm text-muted-foreground">
          Achievements and bug resolutions for this workspace.
        </p>
      </div>

      {isLogsPending ? <BragLogListSkeleton /> : null}

      {isLogsError ? (
        <BragLogErrorState onRetry={() => void refetchLogs()} />
      ) : null}

      {!isLogsPending && !isLogsError && workspaceLogs.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : null}

      {!isLogsPending && !isLogsError && workspaceLogs.length > 0 ? (
        <BragLogList
          logs={workspaceLogs}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      ) : null}

      <BragLogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        bragLog={editing}
        workspaceId={workspace.id}
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
            <DialogTitle>Delete brag log</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleting?.title}&rdquo;?
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

      <WorkspaceFormDialog
        open={editWorkspaceOpen}
        onOpenChange={setEditWorkspaceOpen}
        workspace={workspace}
      />

      <Dialog open={deleteWorkspaceOpen} onOpenChange={setDeleteWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{workspace.name}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteWorkspaceOpen(false)}
              disabled={workspaceDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteWorkspace}
              disabled={workspaceDeleteMutation.isPending}
            >
              {workspaceDeleteMutation.isPending ? (
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
