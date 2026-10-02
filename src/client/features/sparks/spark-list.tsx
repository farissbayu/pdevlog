import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  FileText,
  Pencil,
  Trash2,
  Trophy,
} from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";
import { cn } from "cn";

import { Button } from "@/client/components/ui/button";
import type { SparkResponse, SparkStatus } from "@/shared/schemas/spark";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export function SparkContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const parts = content.split(URL_PATTERN);
  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, index) =>
        URL_PATTERN.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

function formatSparkDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusStyles: Record<SparkStatus, string> = {
  open: "bg-primary/10 text-primary",
  archived: "bg-muted text-muted-foreground",
  promoted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function StatusBadge({ status }: { status: SparkStatus }) {
  const label =
    status === "open" ? "Open" : status === "archived" ? "Archived" : "Promoted";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        statusStyles[status],
      )}
    >
      {label}
    </span>
  );
}

export function SparkListSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <li key={index} className="space-y-3 rounded-lg border bg-card p-5">
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

export function SparkErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Failed to load sparks</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading your sparks.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

type SparkListProps = {
  sparks: SparkResponse[];
  onOpen: (spark: SparkResponse) => void;
  onDelete: (spark: SparkResponse) => void;
  onArchive: (spark: SparkResponse) => void;
  onPromoteToNote: (spark: SparkResponse) => void;
  onPromoteToBrag: (spark: SparkResponse) => void;
  onViewImage: (spark: SparkResponse, index: number) => void;
};

export function SparkList({
  sparks,
  onOpen,
  onDelete,
  onArchive,
  onPromoteToNote,
  onPromoteToBrag,
  onViewImage,
}: SparkListProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sparks.map((spark) => {
        const promotedHref =
          spark.promotedType === "learning-note"
            ? `/learning-notes/${spark.promotedId}`
            : spark.promotedType === "brag-log"
              ? `/brag-logs/${spark.promotedId}`
              : null;

        const visibleAttachments = spark.attachments.slice(0, 3);
        const extraCount = spark.attachments.length - visibleAttachments.length;

        return (
          <li
            key={spark.id}
            className="flex flex-col gap-3 rounded-lg border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
          >
            <button
              type="button"
              className="text-left"
              onClick={() => onOpen(spark)}
            >
              {spark.content ? (
                <SparkContent
                  content={spark.content}
                  className="line-clamp-5 text-sm"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Image spark
                </span>
              )}
            </button>

            {visibleAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {visibleAttachments.map((attachment, index) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className="relative size-16 overflow-hidden rounded-md border transition-opacity hover:opacity-90"
                    onClick={() => onViewImage(spark, index)}
                    aria-label="View image"
                  >
                    <img
                      src={attachment.url}
                      alt="Spark attachment"
                      className="size-full object-cover"
                      loading="lazy"
                    />
                    {index === visibleAttachments.length - 1 &&
                    extraCount > 0 ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-white">
                        +{extraCount}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={spark.status} />
              <span>{formatSparkDate(spark.createdAt)}</span>
            </div>

            {spark.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {spark.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}

            {promotedHref ? (
              <Link
                to={promotedHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ArrowUpRight className="size-3.5" />
                Promoted to {spark.promotedType === "brag-log" ? "brag log" : "learning note"}
              </Link>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center gap-1 border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onPromoteToNote(spark)}
              >
                <FileText className="size-3.5" />
                Note
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onPromoteToBrag(spark)}
              >
                <Trophy className="size-3.5" />
                Brag
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onArchive(spark)}
              >
                {spark.status === "archived" ? (
                  <ArchiveRestore className="size-3.5" />
                ) : (
                  <Archive className="size-3.5" />
                )}
                {spark.status === "archived" ? "Reopen" : "Archive"}
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit spark"
                  title="Edit spark"
                  onClick={() => onOpen(spark)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete spark"
                  title="Delete spark"
                  onClick={() => onDelete(spark)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
