import { FileText, Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { FilterBar } from "@/client/components/filter-bar";
import { PaginationControls } from "@/client/components/pagination";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { useTagsQuery } from "@/client/features/tags/api";
import { useWorkspacesQuery } from "@/client/features/workspaces/api";
import { useFilterParams } from "@/client/lib/use-filter-params";
import type { BragLogResponse } from "@/shared/schemas/brag-log";

import { useBragLogsQuery, useDeleteBragLogMutation } from "./api";
import { BragLogFormDialog } from "./brag-log-form";
import {
  BragLogErrorState,
  BragLogList,
  BragLogListSkeleton,
} from "./brag-log-list";

export function BragLogsPage() {
  const filterApi = useFilterParams();
  const { data, isPending, isError, refetch } = useBragLogsQuery(
    filterApi.filters,
  );
  const logs = data?.bragLogs ?? [];
  const pagination = data?.pagination;
  const { data: tags = [] } = useTagsQuery();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BragLogResponse | null>(null);
  const [deleting, setDeleting] = useState<BragLogResponse | null>(null);
  const deleteMutation = useDeleteBragLogMutation();

  const openEdit = (log: BragLogResponse) => {
    setEditing(log);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="size-6 text-primary" />
            Brag Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Every achievement and bug resolution — in a workspace or standalone.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New brag log
        </Button>
      </div>

      <FilterBar
        api={filterApi}
        tags={tags}
        workspaces={workspaces}
        searchPlaceholder="Search brag logs..."
      />

      {isPending ? <BragLogListSkeleton /> : null}

      {isError ? <BragLogErrorState onRetry={() => void refetch()} /> : null}

      {!isPending && !isError && data && logs.length === 0 ? (
        filterApi.hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                No matching brag logs
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                No brag logs match your filters. Try adjusting your search or
                resetting the filters.
              </p>
            </div>
            <Button variant="outline" onClick={filterApi.reset}>
              Reset filters
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">No brag logs yet</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Log your wins with the STAR framework — assign them to a
                workspace or keep them standalone.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              New brag log
            </Button>
          </div>
        )
      ) : null}

      {!isPending && !isError && logs.length > 0 ? (
        <>
          <BragLogList logs={logs} onEdit={openEdit} onDelete={setDeleting} />
          {pagination ? (
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={filterApi.setPage}
            />
          ) : null}
        </>
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
