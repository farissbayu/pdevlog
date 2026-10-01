import { NotebookPen } from "lucide-react";
import { Link } from "react-router";

import { FilterBar } from "@/client/components/filter-bar";
import { PaginationControls } from "@/client/components/pagination";
import { Button } from "@/client/components/ui/button";
import { useTagsQuery } from "@/client/features/tags/api";
import { useWorkspacesQuery } from "@/client/features/workspaces/api";
import { useFilterParams } from "@/client/lib/use-filter-params";

import { useLearningNotesQuery } from "./api";
import {
  LearningNoteErrorState,
  LearningNoteList,
  LearningNoteListSkeleton,
} from "./learning-note-list";

export function LearningNotesPage() {
  const filterApi = useFilterParams();
  const { data, isPending, isError, refetch } = useLearningNotesQuery(
    filterApi.filters,
  );
  const notes = data?.learningNotes ?? [];
  const pagination = data?.pagination;
  const { data: tags = [] } = useTagsQuery();
  const { data: workspaces = [] } = useWorkspacesQuery();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Learning Notes</h1>
        <p className="text-sm text-muted-foreground">
          Structured Markdown notes for the things you learn. Create new notes
          from a workspace.
        </p>
      </div>

      <FilterBar
        api={filterApi}
        tags={tags}
        workspaces={workspaces}
        searchPlaceholder="Search learning notes..."
      />

      {isPending ? <LearningNoteListSkeleton /> : null}

      {isError ? (
        <LearningNoteErrorState onRetry={() => void refetch()} />
      ) : null}

      {!isPending && !isError && data && notes.length === 0 ? (
        filterApi.hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <NotebookPen className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">No matching notes</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                No learning notes match your filters. Try adjusting your search
                or resetting the filters.
              </p>
            </div>
            <Button variant="outline" onClick={filterApi.reset}>
              Reset filters
            </Button>
          </div>
        ) : (
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
        )
      ) : null}

      {!isPending && !isError && notes.length > 0 ? (
        <>
          <LearningNoteList notes={notes} />
          {pagination ? (
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={filterApi.setPage}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
