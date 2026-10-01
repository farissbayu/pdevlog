import { AlertTriangle } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/client/components/ui/button";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";
import type { LearningNoteResponse } from "@/shared/schemas/learning-note";
import type { TagResponse } from "@/shared/schemas/tag";

export function formatNoteDate(value: string): string {
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

export function noteExcerpt(content: string, max = 180): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

function NoteTagChip({ tag }: { tag: TagResponse }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {tag.name}
    </span>
  );
}

export function LearningNoteListSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <li key={index} className="space-y-3 rounded-lg border bg-card p-5">
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

export function LearningNoteErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Failed to load learning notes</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading your notes.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

type LearningNoteListProps = {
  notes: LearningNoteResponse[];
};

export function LearningNoteList({ notes }: LearningNoteListProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-lg border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
        >
          <div className="min-w-0 space-y-2">
            <Link
              to={`/learning-notes/${note.id}`}
              className="block truncate font-medium hover:underline"
            >
              {note.title}
            </Link>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {noteExcerpt(note.content) || "Empty note"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Updated {formatNoteDate(note.updatedAt)}</span>
              {note.workspace ? (
                <WorkspaceTypeBadge type={note.workspace.type} />
              ) : null}
              {note.workspace ? <span>{note.workspace.name}</span> : null}
            </div>
            {note.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <NoteTagChip key={tag.id} tag={tag} />
                ))}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
