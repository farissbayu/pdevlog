import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  FolderKanban,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Rocket,
  SearchX,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { PaginationControls } from "@/client/components/pagination";
import { SearchInput } from "@/client/components/search-input";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { useBragLogsQuery, useDeleteBragLogMutation } from "@/client/features/brag-logs/api";
import { BragLogFormDialog } from "@/client/features/brag-logs/brag-log-form";
import {
  BragLogErrorState,
  BragLogList,
  BragLogListSkeleton,
} from "@/client/features/brag-logs/brag-log-list";
import { useNotesQuery } from "@/client/features/notes/api";
import {
  NoteErrorState,
  NoteList,
  NoteListSkeleton,
} from "@/client/features/notes/note-list";
import { ProjectFormDialog } from "@/client/features/projects/project-form-dialog";
import { useProjectsQuery } from "@/client/features/projects/api";
import { SourceList } from "@/client/features/sources/source-list";
import { EMPTY_FILTERS, useFilterParams } from "@/client/lib/use-filter-params";
import { cn } from "@/client/lib/utils";
import type { BragLogResponse } from "@/shared/schemas/brag-log";
import type { ProjectResponse } from "@/shared/schemas/project";

import { useDeleteWorkspaceMutation, useWorkspaceDetailQuery } from "./api";
import { WorkspaceFormDialog } from "./workspace-form-dialog";
import { WorkspaceTypeBadge } from "./workspace-type-badge";

type WorkspaceTab = "projects" | "brag-logs" | "notes";

function EmptyState({
  onCreate,
  filtered = false,
  onReset,
}: {
  onCreate: () => void;
  filtered?: boolean;
  onReset?: () => void;
}) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">No matching brag logs</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            No brag logs in this workspace match your search.
          </p>
        </div>
        <Button variant="outline" onClick={onReset}>
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FileText className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No brag logs yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Record your wins and bug fixes for this workspace using the STAR
          framework.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        New brag log
      </Button>
    </div>
  );
}

function NotesEmptyState({
  onCreate,
  filtered = false,
  onReset,
}: {
  onCreate: () => void;
  filtered?: boolean;
  onReset?: () => void;
}) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">No matching notes</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            No notes in this workspace match your search.
          </p>
        </div>
        <Button variant="outline" onClick={onReset}>
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <NotebookPen className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No notes yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Capture notes about this workspace in Markdown, with code blocks,
          tables, and tags.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        New note
      </Button>
    </div>
  );
}

function ProjectsEmptyState({
  onCreate,
  filtered = false,
  onReset,
}: {
  onCreate: () => void;
  filtered?: boolean;
  onReset?: () => void;
}) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">No matching projects</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            No projects in this workspace match your search.
          </p>
        </div>
        <Button variant="outline" onClick={onReset}>
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Rocket className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No projects yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Track backlogs and changelogs for software you build in this workspace.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        New project
      </Button>
    </div>
  );
}

export function WorkspaceDetailPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterApi = useFilterParams();

  const {
    data: workspace,
    isPending: isWorkspacePending,
    isError: isWorkspaceError,
    refetch: refetchWorkspace,
  } = useWorkspaceDetailQuery(id);

  const rawTab = searchParams.get("tab");
  const activeTab: WorkspaceTab =
    rawTab === "brag-logs" && workspace?.type === "work"
      ? "brag-logs"
      : rawTab === "notes"
        ? "notes"
        : "projects";

  const projectsFilters = useMemo(
    () =>
      activeTab === "projects"
        ? {
            workspaceId: id,
            q: filterApi.filters.q,
            page: filterApi.filters.page,
          }
        : { workspaceId: id },
    [activeTab, filterApi.filters.q, filterApi.filters.page, id],
  );

  const logsFilters = useMemo(
    () =>
      activeTab === "brag-logs"
        ? { ...filterApi.filters, workspaceId: id }
        : { ...EMPTY_FILTERS, workspaceId: id },
    [activeTab, filterApi.filters, id],
  );

  const notesFilters = useMemo(
    () =>
      activeTab === "notes"
        ? { ...filterApi.filters, workspaceId: id }
        : { ...EMPTY_FILTERS, workspaceId: id },
    [activeTab, filterApi.filters, id],
  );

  const {
    data: logsData,
    isPending: isLogsPending,
    isError: isLogsError,
    refetch: refetchLogs,
  } = useBragLogsQuery(logsFilters);

  const {
    data: notesData,
    isPending: isNotesPending,
    isError: isNotesError,
    refetch: refetchNotes,
  } = useNotesQuery(notesFilters);

  const {
    data: projectsData,
    isPending: isProjectsPending,
    isError: isProjectsError,
    refetch: refetchProjects,
  } = useProjectsQuery(projectsFilters);

  const deleteMutation = useDeleteBragLogMutation();
  const workspaceDeleteMutation = useDeleteWorkspaceMutation();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BragLogResponse | null>(null);
  const [deleting, setDeleting] = useState<BragLogResponse | null>(null);
  const [editWorkspaceOpen, setEditWorkspaceOpen] = useState(false);
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectResponse | null>(
    null,
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (log: BragLogResponse) => {
    setEditing(log);
    setFormOpen(true);
  };

  const openCreateNote = () => {
    navigate(`/notes/new?workspace=${id}`);
  };

  const openCreateProject = () => {
    setEditingProject(null);
    setProjectFormOpen(true);
  };

  const handleTabChange = (newTab: WorkspaceTab) => {
    filterApi.setQuery("");
    setSearchParams(
      () => {
        const next = new URLSearchParams();
        if (newTab !== "projects") {
          next.set("tab", newTab);
        }
        return next;
      },
      { replace: false },
    );
  };

  const handleResetSearch = () => {
    filterApi.setQuery("");
    setSearchParams(
      () => {
        const next = new URLSearchParams();
        if (activeTab !== "projects") {
          next.set("tab", activeTab);
        }
        return next;
      },
      { replace: true },
    );
  };

  const confirmDelete = () => {
    if (!deleting) {
      return;
    }
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success("Brag log deleted");
      },
    });
  };

  const confirmDeleteWorkspace = () => {
    if (!workspace) {
      return;
    }
    workspaceDeleteMutation.mutate(workspace.id, {
      onSuccess: () => {
        navigate("/workspaces");
        toast.success("Workspace deleted");
      },
    });
  };

  if (isWorkspacePending) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isWorkspaceError || !workspace) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Workspace not found</h2>
          <p className="text-sm text-muted-foreground">
            This workspace may have been deleted or you do not have access to
            it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetchWorkspace()}>
            Try again
          </Button>
          <Button asChild>
            <Link to="/workspaces">Back to workspaces</Link>
          </Button>
        </div>
      </div>
    );
  }

  const workspaceLogs = logsData?.bragLogs ?? [];
  const logsPagination = logsData?.pagination;
  const workspaceNotes = notesData?.notes ?? [];
  const notesPagination = notesData?.pagination;
  const workspaceProjects = projectsData?.projects ?? [];
  const projectsPagination = projectsData?.pagination;
  const hasQuery = filterApi.filters.q.trim().length > 0;

  const tabs = [
    {
      value: "projects" as const,
      label: "Projects",
      count: projectsPagination?.total ?? workspaceProjects.length,
      icon: Rocket,
    },
    ...(workspace.type === "work"
      ? [
          {
            value: "brag-logs" as const,
            label: "Brag logs",
            count: logsPagination?.total ?? workspaceLogs.length,
            icon: FileText,
          },
        ]
      : []),
    {
      value: "notes" as const,
      label: "Notes",
      count: notesPagination?.total ?? workspaceNotes.length,
      icon: NotebookPen,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/workspaces"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Workspaces
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <FolderKanban className="size-6 text-primary" />
              {workspace.name}
            </h1>
            <WorkspaceTypeBadge type={workspace.type} />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {workspace.description || "No description"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Edit workspace"
            title="Edit workspace"
            onClick={() => setEditWorkspaceOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            aria-label="Delete workspace"
            title="Delete workspace"
            onClick={() => setDeleteWorkspaceOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {workspace.sources.length > 0 ? (
        <SourceList sources={workspace.sources} title="Sources" />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {tabs.map((entry) => {
            const Icon = entry.icon;
            const isActive = activeTab === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => handleTabChange(entry.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{entry.label}</span>
                {typeof entry.count === "number" ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {entry.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div>
          {activeTab === "projects" ? (
            <Button onClick={openCreateProject}>
              <Plus className="size-4" />
              New project
            </Button>
          ) : null}

          {activeTab === "brag-logs" ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              New brag log
            </Button>
          ) : null}

          {activeTab === "notes" ? (
            <Button onClick={openCreateNote}>
              <Plus className="size-4" />
              New note
            </Button>
          ) : null}
        </div>
      </div>

      {activeTab === "projects" ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Projects</h2>
            <p className="text-sm text-muted-foreground">
              Backlogs and changelogs for software you build in this workspace.
            </p>
          </div>

          <SearchInput
            value={filterApi.query}
            onChange={(event) => filterApi.setQuery(event.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
            className="max-w-sm"
          />

          {isProjectsPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-lg border bg-card"
                />
              ))}
            </div>
          ) : null}

          {isProjectsError ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-12 text-center">
              <AlertTriangle className="size-6 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Failed to load projects.
              </p>
              <Button
                variant="outline"
                onClick={() => void refetchProjects()}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {!isProjectsPending &&
          !isProjectsError &&
          workspaceProjects.length === 0 ? (
            <ProjectsEmptyState
              onCreate={openCreateProject}
              filtered={hasQuery}
              onReset={handleResetSearch}
            />
          ) : null}

          {!isProjectsPending &&
          !isProjectsError &&
          workspaceProjects.length > 0 ? (
            <>
              <ul className="grid gap-3 sm:grid-cols-2">
                {workspaceProjects.map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/workspaces/${id}/projects/${project.id}`}
                      className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-center gap-2">
                        <Rocket className="size-4 text-primary" />
                        <span className="font-medium">{project.name}</span>
                        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                          {project.status}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {project.tagline ||
                          project.description ||
                          "No description"}
                      </p>
                      <div className="mt-auto flex gap-3 pt-2 text-xs text-muted-foreground">
                        <span>{project.backlogCount} backlog</span>
                        <span>{project.shippedCount} shipped</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              {projectsPagination ? (
                <PaginationControls
                  page={projectsPagination.page}
                  totalPages={projectsPagination.totalPages}
                  onPageChange={filterApi.setPage}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === "brag-logs" && workspace.type === "work" ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Brag logs</h2>
            <p className="text-sm text-muted-foreground">
              Achievements and bug resolutions for this workspace.
            </p>
          </div>

          <SearchInput
            value={filterApi.query}
            onChange={(event) => filterApi.setQuery(event.target.value)}
            placeholder="Search brag logs..."
            aria-label="Search brag logs"
            className="max-w-sm"
          />

          {isLogsPending ? <BragLogListSkeleton /> : null}

          {isLogsError ? (
            <BragLogErrorState onRetry={() => void refetchLogs()} />
          ) : null}

          {!isLogsPending && !isLogsError && workspaceLogs.length === 0 ? (
            <EmptyState
              onCreate={openCreate}
              filtered={hasQuery}
              onReset={handleResetSearch}
            />
          ) : null}

          {!isLogsPending && !isLogsError && workspaceLogs.length > 0 ? (
            <>
              <BragLogList
                logs={workspaceLogs}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
              {logsPagination ? (
                <PaginationControls
                  page={logsPagination.page}
                  totalPages={logsPagination.totalPages}
                  onPageChange={filterApi.setPage}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === "notes" ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Notes</h2>
            <p className="text-sm text-muted-foreground">
              Markdown notes for this workspace.
            </p>
          </div>

          <SearchInput
            value={filterApi.query}
            onChange={(event) => filterApi.setQuery(event.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="max-w-sm"
          />

          {isNotesPending ? <NoteListSkeleton /> : null}

          {isNotesError ? (
            <NoteErrorState onRetry={() => void refetchNotes()} />
          ) : null}

          {!isNotesPending && !isNotesError && workspaceNotes.length === 0 ? (
            <NotesEmptyState
              onCreate={openCreateNote}
              filtered={hasQuery}
              onReset={handleResetSearch}
            />
          ) : null}

          {!isNotesPending && !isNotesError && workspaceNotes.length > 0 ? (
            <>
              <NoteList notes={workspaceNotes} />
              {notesPagination ? (
                <PaginationControls
                  page={notesPagination.page}
                  totalPages={notesPagination.totalPages}
                  onPageChange={filterApi.setPage}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <BragLogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        bragLog={editing}
        workspaceId={workspace.id}
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

      <ProjectFormDialog
        open={projectFormOpen}
        onOpenChange={(open) => {
          setProjectFormOpen(open);
          if (!open) {
            setEditingProject(null);
          }
        }}
        workspaceId={workspace.id}
        project={editingProject}
      />

      <WorkspaceFormDialog
        open={editWorkspaceOpen}
        onOpenChange={setEditWorkspaceOpen}
        workspace={workspace}
      />

      <Dialog open={deleteWorkspaceOpen} onOpenChange={setDeleteWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{workspace.name}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteWorkspaceOpen(false)}
              disabled={workspaceDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteWorkspace}
              disabled={workspaceDeleteMutation.isPending}
            >
              {workspaceDeleteMutation.isPending ? (
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
