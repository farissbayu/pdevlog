import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Lightbulb,
  Loader2,
  Pencil,
  Target,
  Trash2,
  TrendingUp,
  Wrench,
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
import { WorkspaceLabel } from "@/client/features/workspaces/workspace-label";

import {
  useBragLogDetailQuery,
  useDeleteBragLogMutation,
} from "./api";
import { BragLogFormDialog } from "./brag-log-form";
import { TagChip, formatBragLogDate } from "./tag-chip";

const starSections = [
  {
    key: "situation",
    label: "Situation",
    icon: Lightbulb,
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "task",
    label: "Task",
    icon: Target,
    className: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "action",
    label: "Action",
    icon: Wrench,
    className: "text-violet-600 dark:text-violet-400",
  },
  {
    key: "result",
    label: "Result",
    icon: TrendingUp,
    className: "text-emerald-600 dark:text-emerald-400",
  },
] as const;

export function BragLogDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useBragLogDetailQuery(id);
  const deleteMutation = useDeleteBragLogMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const confirmDelete = () => {
    if (!data) {
      return;
    }
    deleteMutation.mutate(data.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate("/brag-logs");
      },
    });
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Brag log not found</h2>
          <p className="text-sm text-muted-foreground">
            This log may have been deleted or you do not have access to it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
          <Button asChild>
            <Link to="/brag-logs">Back to brag logs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/brag-logs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Brag logs
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatBragLogDate(data.occurredAt)}
            </span>
            <WorkspaceLabel workspace={data.workspace} />
          </div>
          {data.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Edit brag log"
            title="Edit brag log"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            aria-label="Delete brag log"
            title="Delete brag log"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {starSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.key}
              className="rounded-lg border bg-card p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className={section.className} />
                <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </h2>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {data[section.key]}
              </p>
            </div>
          );
        })}
      </div>

      <BragLogFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        bragLog={data}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete brag log</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{data.title}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
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
