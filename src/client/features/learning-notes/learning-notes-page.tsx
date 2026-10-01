import { Loader2, NotebookPen } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import type { LearningNoteResponse } from "@/shared/schemas/learning-note";

import { useDeleteLearningNoteMutation, useLearningNotesQuery } from "./api";
import {
  LearningNoteErrorState,
  LearningNoteList,
  LearningNoteListSkeleton,
} from "./learning-note-list";

export function LearningNotesPage() {
  const { data, isPending, isError, refetch } = useLearningNotesQuery();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<LearningNoteResponse | null>(null);
  const deleteMutation = useDeleteLearningNoteMutation();

  const openEdit = (note: LearningNoteResponse) => {
    navigate(`/learning-notes/${note.id}/edit`);
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
        <h1 className="text-2xl font-semibold">Learning Notes</h1>
        <p className="text-sm text-muted-foreground">
          Structured Markdown notes for the things you learn. Create new notes
          from a workspace.
        </p>
      </div>

      {isPending ? <LearningNoteListSkeleton /> : null}

      {isError ? (
        <LearningNoteErrorState onRetry={() => void refetch()} />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <NotebookPen className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No learning notes yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Open a workspace to capture what you learn with Markdown, code
              blocks, tables, and tags.
            </p>
          </div>
          <Button asChild>
            <Link to="/workspaces">
              <NotebookPen className="size-4" />
              Go to workspaces
            </Link>
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <LearningNoteList
          notes={data}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
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
            <DialogTitle>Delete note</DialogTitle>
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
