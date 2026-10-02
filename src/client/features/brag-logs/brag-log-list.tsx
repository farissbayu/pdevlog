import {
  AlertTriangle,
  CalendarDays,
  Pencil,
  Trash2,
} from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/client/components/ui/button";
import { WorkspaceLabel } from "@/client/features/workspaces/workspace-label";
import type { BragLogResponse } from "@/shared/schemas/brag-log";

import { TagChip, formatBragLogDate } from "./tag-chip";

export function BragLogListSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <li key={index} className="space-y-3 rounded-lg border bg-card p-5">
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

export function BragLogErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Failed to load brag logs</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading your brag logs.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

type BragLogListProps = {
  logs: BragLogResponse[];
  onEdit: (log: BragLogResponse) => void;
  onDelete: (log: BragLogResponse) => void;
};

export function BragLogList({ logs, onEdit, onDelete }: BragLogListProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {logs.map((log) => (
        <li
          key={log.id}
          className="group flex flex-col gap-3 rounded-lg border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Link
                to={`/brag-logs/${log.id}`}
                className="block truncate font-medium hover:underline"
              >
                {log.title}
              </Link>
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {log.result}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${log.title}`}
                onClick={() => onEdit(log)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${log.title}`}
                onClick={() => onDelete(log)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatBragLogDate(log.occurredAt)}
              </span>
              <WorkspaceLabel workspace={log.workspace} />
            </div>
            {log.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {log.tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
