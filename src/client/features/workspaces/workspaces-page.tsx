import { AlertTriangle, FolderPlus, Plus, SearchX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PaginationControls } from "@/client/components/pagination";
import { SearchInput } from "@/client/components/search-input";
import { Button } from "@/client/components/ui/button";
import { useFilterParams } from "@/client/lib/use-filter-params";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";

import { useWorkspacesListQuery } from "./api";
import { WorkspaceFormDialog } from "./workspace-form-dialog";
import { WorkspaceTypeBadge } from "./workspace-type-badge";

function WorkspaceListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border bg-card p-5"
        >
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FolderPlus className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Create your first workspace</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Workspaces group your brag logs and learning notes. Start with a work
          project or a learning track.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        New workspace
      </Button>
    </div>
  );
}

function NoMatchesState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No matching workspaces</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          No workspaces match your search. Try a different keyword.
        </p>
      </div>
      <Button variant="outline" onClick={onReset}>
        Clear search
      </Button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Failed to load workspaces</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading your workspaces.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceResponse }) {
  return (
    <Link
      to={`/workspaces/${workspace.id}`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="min-w-0 space-y-1">
        <h2 className="truncate font-medium">{workspace.name}</h2>
        <WorkspaceTypeBadge type={workspace.type} />
      </div>
      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {workspace.description || "No description"}
      </p>
    </Link>
  );
}

export function WorkspacesPage() {
  const filterApi = useFilterParams();
  const { data, isPending, isError, refetch } = useWorkspacesListQuery({
    q: filterApi.filters.q,
    page: filterApi.filters.page,
  });
  const [formOpen, setFormOpen] = useState(false);

  const workspaces = data?.workspaces ?? [];
  const pagination = data?.pagination;
  const hasQuery = filterApi.filters.q.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Manage the workspaces that group your logs and notes.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          New workspace
        </Button>
      </div>

      <SearchInput
        value={filterApi.query}
        onChange={(event) => filterApi.setQuery(event.target.value)}
        placeholder="Search workspaces..."
        aria-label="Search workspaces"
        className="max-w-sm"
      />

      {isPending ? <WorkspaceListSkeleton /> : null}

      {isError ? <ErrorState onRetry={() => void refetch()} /> : null}

      {!isPending && !isError && data && workspaces.length === 0 ? (
        hasQuery ? (
          <NoMatchesState onReset={filterApi.reset} />
        ) : (
          <EmptyState onCreate={() => setFormOpen(true)} />
        )
      ) : null}

      {!isPending && !isError && workspaces.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
          {pagination ? (
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={filterApi.setPage}
            />
          ) : null}
        </>
      ) : null}

      <WorkspaceFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
