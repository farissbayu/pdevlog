import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  FileText,
  Loader2,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { MarkdownRenderer } from "@/client/components/markdown-renderer";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { SourceList } from "@/client/features/sources/source-list";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";

import { useDeleteNoteMutation, useNoteDetailQuery } from "./api";
import { formatNoteDate } from "./note-list";
import { countWords, estimateReadingMinutes } from "./note-stats";
import { NoteToc, extractHeadings } from "./note-toc";

export function NoteDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useNoteDetailQuery(id);
  const deleteMutation = useDeleteNoteMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const headings = useMemo(
    () => (data ? extractHeadings(data.content) : []),
    [data],
  );

  const stats = useMemo(() => {
    if (!data) {
      return null;
    }
    return {
      words: countWords(data.content),
      readingMinutes: estimateReadingMinutes(data.content),
    };
  }, [data]);

  const confirmDelete = () => {
    if (!data) {
      return;
    }
    deleteMutation.mutate(data.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate(
          data.workspace
            ? `/workspaces/${data.workspace.id}`
            : "/notes",
        );
        toast.success("Note deleted");
      },
    });
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
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
          <h2 className="text-lg font-semibold">Note not found</h2>
          <p className="text-sm text-muted-foreground">
            This note may have been deleted or you do not have access to it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
          <Button asChild>
            <Link to="/workspaces">Back to workspaces</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={
            data.workspace
              ? `/workspaces/${data.workspace.id}`
              : "/notes"
          }
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {data.workspace ? data.workspace.name : "Notes"}
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <NotebookPen className="size-6 text-primary" />
            {data.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Updated {formatNoteDate(data.updatedAt)}</span>
            {stats ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {stats.readingMinutes} min read
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="size-3.5" />
                  {stats.words.toLocaleString()}{" "}
                  {stats.words === 1 ? "word" : "words"}
                </span>
              </>
            ) : null}
            {data.workspace ? (
              <WorkspaceTypeBadge type={data.workspace.type} />
            ) : null}
            {data.workspace ? <span>{data.workspace.name}</span> : null}
          </div>
          {data.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link
              to={`/notes/${data.id}/edit`}
              aria-label="Edit note"
              title="Edit note"
            >
              <Pencil className="size-4" />
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="icon"
            aria-label="Delete note"
            title="Delete note"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <SourceList sources={data.sources} />
      {data.workspace && data.workspace.sources.length > 0 ? (
        <SourceList
          sources={data.workspace.sources}
          title={`Workspace sources · ${data.workspace.name}`}
        />
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-6">
          {headings.length > 0 ? (
            <details className="rounded-lg border bg-card px-4 py-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">
                On this page
              </summary>
              <div className="pt-3">
                <NoteToc headings={headings} />
              </div>
            </details>
          ) : null}

          <article className="rounded-lg border bg-card p-6">
            <MarkdownRenderer content={data.content} />
          </article>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100svh-3rem)] overflow-y-auto">
            <NoteToc headings={headings} />
          </div>
        </aside>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
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
