import { AlertTriangle, Loader2, Sparkles, Shuffle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { cn } from "cn";
import { toast } from "sonner";

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
import { BragLogFormDialog } from "@/client/features/brag-logs/brag-log-form";
import { useTagsQuery } from "@/client/features/tags/api";
import { useFilterParams } from "@/client/lib/use-filter-params";
import type { SparkResponse, SparkStatus } from "@/shared/schemas/spark";

import {
  useDeleteSparkMutation,
  useRecallSparkMutation,
  useSparksQuery,
  useUpdateSparkMutation,
} from "./api";
import { SparkLightbox } from "./spark-lightbox";
import { SparkList, SparkListSkeleton, SparkErrorState } from "./spark-list";
import { useSparks } from "./sparks-provider";

type StatusTab = SparkStatus | "all";

const statusTabs: { value: StatusTab; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "promoted", label: "Promoted" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

export function SparksPage() {
  const filterApi = useFilterParams();
  const navigate = useNavigate();
  const { openSpark } = useSparks();
  const { data: tags = [] } = useTagsQuery();

  const statusParam = filterApi.filters.status;
  const activeStatus: StatusTab =
    statusParam === "all" ? "all" : ((statusParam || "open") as StatusTab);
  const effectiveStatus = activeStatus === "all" ? "" : activeStatus;

  const { data, isPending, isError, refetch } = useSparksQuery({
    ...filterApi.filters,
    status: effectiveStatus,
  });
  const sparks = data?.sparks ?? [];
  const pagination = data?.pagination;

  const updateMutation = useUpdateSparkMutation();
  const deleteMutation = useDeleteSparkMutation();
  const recallMutation = useRecallSparkMutation();

  const [deleting, setDeleting] = useState<SparkResponse | null>(null);
  const [bragSpark, setBragSpark] = useState<SparkResponse | null>(null);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    spark: SparkResponse;
    index: number;
  } | null>(null);

  const handleArchive = (spark: SparkResponse) => {
    updateMutation.mutate(
      {
        id: spark.id,
        input: { status: spark.status === "open" ? "archived" : "open" },
      },
      {
        onSuccess: () =>
          toast.success(
            spark.status === "open" ? "Spark archived" : "Spark reopened",
          ),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) {
      return;
    }
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success("Spark deleted");
      },
    });
  };

  const handleRecall = () => {
    setRecallError(null);
    recallMutation.mutate(undefined, {
      onSuccess: (spark) => openSpark(spark),
      onError: (error) => setRecallError(error.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles className="size-6 text-primary" />
            Sparks
          </h1>
          <p className="text-sm text-muted-foreground">
            Dump anything worth remembering. It waits here until you use it.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            onClick={handleRecall}
            disabled={recallMutation.isPending}
          >
            {recallMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Shuffle className="size-4" />
            )}
            Surprise me
          </Button>
          {recallError ? (
            <p className="text-xs text-muted-foreground">{recallError}</p>
          ) : null}
        </div>
      </div>

      <FilterBar
        api={filterApi}
        tags={tags}
        searchPlaceholder="Search sparks..."
      />

      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => filterApi.setStatus(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeStatus === tab.value
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isPending ? <SparkListSkeleton /> : null}

      {isError ? <SparkErrorState onRetry={() => void refetch()} /> : null}

      {!isPending && !isError && sparks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              {filterApi.hasActiveFilters
                ? "No matching sparks"
                : activeStatus === "open"
                  ? "No open sparks"
                  : "Nothing here yet"}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filterApi.hasActiveFilters
                ? "No sparks match your filters. Try adjusting your search or resetting the filters."
                : "Press ⌘/Ctrl + K anywhere, or use the Spark button, to capture a link, idea, or “try this later”."}
            </p>
          </div>
          {filterApi.hasActiveFilters ? (
            <Button variant="outline" onClick={filterApi.reset}>
              Reset filters
            </Button>
          ) : (
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          )}
        </div>
      ) : null}

      {!isPending && !isError && sparks.length > 0 ? (
        <>
          <SparkList
            sparks={sparks}
            onOpen={openSpark}
            onDelete={setDeleting}
            onArchive={handleArchive}
            onPromoteToNote={(spark) =>
              navigate(`/notes/new?spark=${spark.id}`)
            }
            onPromoteToBrag={setBragSpark}
            onViewImage={(spark, index) => setLightbox({ spark, index })}
          />
          {pagination ? (
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={filterApi.setPage}
            />
          ) : null}
        </>
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
            <DialogTitle>Delete spark</DialogTitle>
            <DialogDescription>
              This will permanently delete this spark. This action cannot be
              undone.
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
              ) : (
                <AlertTriangle className="size-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BragLogFormDialog
        open={Boolean(bragSpark)}
        onOpenChange={(open) => {
          if (!open) {
            setBragSpark(null);
          }
        }}
        spark={bragSpark}
      />

      {lightbox ? (
        <SparkLightbox
          attachments={lightbox.spark.attachments}
          index={lightbox.index}
          onIndexChange={(index) =>
            setLightbox((current) => (current ? { ...current, index } : current))
          }
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}
