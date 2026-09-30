import { FileText, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import type { BragLogResponse } from "@/shared/schemas/brag-log";

import { useBragLogsQuery, useDeleteBragLogMutation } from "./api";
import { BragLogFormDialog } from "./brag-log-form";
import {
  BragLogErrorState,
  BragLogList,
  BragLogListSkeleton,
} from "./brag-log-list";

export function BragLogsPage() {
  const { data, isPending, isError, refetch } = useBragLogsQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BragLogResponse | null>(null);
  const [deleting, setDeleting] = useState<BragLogResponse | null>(null);
  const deleteMutation = useDeleteBragLogMutation();

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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Brag Logs</h1>
        <p className="text-sm text-muted-foreground">
          Every achievement and bug resolution across your workspaces.
        </p>
      </div>

      {isPending ? <BragLogListSkeleton /> : null}

      {isError ? <BragLogErrorState onRetry={() => void refetch()} /> : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No brag logs yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Open a workspace and log your wins with the STAR framework so you
              never forget them.
            </p>
          </div>
          <Button asChild>
            <Link to="/workspaces">
              <Plus className="size-4" />
              Go to workspaces
            </Link>
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <BragLogList logs={data} onEdit={openEdit} onDelete={setDeleting} />
      ) : null}

      <BragLogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        bragLog={editing}
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
    </div>
  );
}
