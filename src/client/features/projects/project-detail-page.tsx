import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleDot,
  Copy,
  GitBranch,
  Globe,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Rocket,
  Trash2,
  Trophy,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { cn } from "cn";
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
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { BragLogFormDialog } from "@/client/features/brag-logs/brag-log-form";
import { useNotesQuery } from "@/client/features/notes/api";
import { NoteList, NoteListSkeleton } from "@/client/features/notes/note-list";
import { EMPTY_FILTERS } from "@/client/lib/use-filter-params";
import type {
  ProjectItemKind,
  ProjectItemResponse,
  ProjectItemStatus,
} from "@/shared/schemas/project";

import {
  fetchChangelogMarkdown,
  useCreateProjectItemMutation,
  useDeleteProjectItemMutation,
  useDeleteProjectMutation,
  useProjectDetailQuery,
  useProjectItemsQuery,
  useShipProjectItemMutation,
  useUpdateProjectItemMutation,
} from "./api";
import { ITEM_KIND_OPTIONS, KindChip } from "./kind-chip";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectItemFormDialog } from "./project-item-form-dialog";

function StatusIcon({ status }: { status: ProjectItemStatus }) {
  if (status === "shipped") {
    return <CheckCircle2 className="size-4 text-emerald-500" />;
  }
  if (status === "in_progress") {
    return <CircleDot className="size-4 text-blue-500" />;
  }
  return <Circle className="size-4 text-muted-foreground" />;
}

function groupBy(
  items: ProjectItemResponse[],
  key: (item: ProjectItemResponse) => string,
): [string, ProjectItemResponse[]][] {
  const groups = new Map<string, ProjectItemResponse[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k) ?? [];
    list.push(item);
    groups.set(k, list);
  }
  return [...groups.entries()];
}

function formatShippedDate(isoString: string | null): string {
  if (!isoString) {
    return "Unreleased";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Unreleased";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProjectDetailPage() {
  const { workspaceId = "", projectId = "" } = useParams();
  const navigate = useNavigate();

  const {
    data: project,
    isPending: isProjectPending,
    isError: isProjectError,
    refetch: refetchProject,
  } = useProjectDetailQuery(projectId);
  const {
    data: items = [],
    isPending: isItemsPending,
    isError: isItemsError,
    refetch: refetchItems,
  } = useProjectItemsQuery(projectId);

  const createItemMutation = useCreateProjectItemMutation();
  const updateItemMutation = useUpdateProjectItemMutation();
  const shipMutation = useShipProjectItemMutation();
  const deleteItemMutation = useDeleteProjectItemMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"backlog" | "changelog" | "notes">(
    searchParams.get("tab") === "notes" ? "notes" : "backlog",
  );
  const [notesSearch, setNotesSearch] = useState("");
  const [notesPage, setNotesPage] = useState(1);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ProjectItemKind>("feat");
  const [targetVersion, setTargetVersion] = useState("Next");
  const [editingItem, setEditingItem] = useState<ProjectItemResponse | null>(
    null,
  );
  const [shippingItem, setShippingItem] = useState<ProjectItemResponse | null>(
    null,
  );
  const [shipVersion, setShipVersion] = useState("");
  const [bragItem, setBragItem] = useState<ProjectItemResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<ProjectItemResponse | null>(
    null,
  );
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const notesQuery = useNotesQuery({
    ...EMPTY_FILTERS,
    workspaceId: project?.workspaceId ?? "",
    projectId,
    q: notesSearch,
    page: notesPage,
  });
  const projectNotes = notesQuery.data?.notes ?? [];
  const notesPagination = notesQuery.data?.pagination;

  const backlogItems = useMemo(
    () =>
      items.filter(
        (item) => item.status === "backlog" || item.status === "in_progress",
      ),
    [items],
  );
  const shippedItems = useMemo(
    () =>
      items
        .filter((item) => item.status === "shipped")
        .sort((a, b) => {
          const timeA = a.shippedAt ? new Date(a.shippedAt).getTime() : 0;
          const timeB = b.shippedAt ? new Date(b.shippedAt).getTime() : 0;
          return timeB - timeA;
        }),
    [items],
  );

  const backlogGroups = useMemo(
    () => groupBy(backlogItems, (item) => item.targetVersion),
    [backlogItems],
  );
  const changelogGroups = useMemo(
    () => groupBy(shippedItems, (item) => formatShippedDate(item.shippedAt)),
    [shippedItems],
  );

  const handleQuickAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    createItemMutation.mutate(
      {
        projectId,
        input: {
          title: trimmed,
          kind,
          target_version: targetVersion.trim() || "Next",
        },
      },
      {
        onSuccess: () => setTitle(""),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const toggleStatus = (item: ProjectItemResponse) => {
    updateItemMutation.mutate({
      projectId,
      itemId: item.id,
      input: {
        status: item.status === "in_progress" ? "backlog" : "in_progress",
      },
    });
  };

  const confirmShip = () => {
    if (!shippingItem) {
      return;
    }
    shipMutation.mutate(
      { projectId, itemId: shippingItem.id, version: shipVersion.trim() || undefined },
      {
        onSuccess: () => {
          setShippingItem(null);
          toast.success("Item shipped");
        },
      },
    );
  };

  const confirmDeleteItem = () => {
    if (!deletingItem) {
      return;
    }
    deleteItemMutation.mutate(
      { projectId, itemId: deletingItem.id },
      {
        onSuccess: () => {
          setDeletingItem(null);
          toast.success("Item deleted");
        },
      },
    );
  };

  const confirmDeleteProject = () => {
    deleteProjectMutation.mutate(projectId, {
      onSuccess: () => {
        navigate(`/workspaces/${workspaceId}`);
        toast.success("Project deleted");
      },
    });
  };

  const copyChangelog = async () => {
    setIsCopying(true);
    try {
      const markdown = await fetchChangelogMarkdown(projectId);
      await navigator.clipboard.writeText(markdown);
      toast.success("CHANGELOG.md copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed");
    } finally {
      setIsCopying(false);
    }
  };

  if (isProjectPending) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isProjectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Project not found</h2>
          <p className="text-sm text-muted-foreground">
            This project may have been deleted or you do not have access to it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetchProject()}>
            Try again
          </Button>
          <Button asChild>
            <Link to={`/workspaces/${workspaceId}`}>Back to workspace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { value: "backlog" | "changelog" | "notes"; label: string }[] = [
    { value: "backlog", label: `Backlog & Plan (${backlogItems.length})` },
    { value: "changelog", label: `Changelog (${shippedItems.length})` },
    { value: "notes", label: `Notes (${project.noteCount})` },
  ];

  return (
    <div className="space-y-6">
      <Link
        to={`/workspaces/${workspaceId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to workspace
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Rocket className="size-6 text-primary" />
              {project.name}
            </h1>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {project.status}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {project.tagline || project.description || "No description"}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {project.repoUrl ? (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <GitBranch className="size-3.5" />
                Repo
              </a>
            ) : null}
            {project.liveUrl ? (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="size-3.5" />
                Live
              </a>
            ) : null}
            <span>
              {project.backlogCount} backlog · {project.shippedCount} shipped
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={copyChangelog} disabled={isCopying}>
            {isCopying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Copy className="size-4" />
            )}
            Copy CHANGELOG.md
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Edit project"
            title="Edit project"
            onClick={() => setEditProjectOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            aria-label="Delete project"
            title="Delete project"
            onClick={() => setDeleteProjectOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {tabs.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setTab(entry.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === entry.value
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {isItemsPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : null}

      {isItemsError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Failed to load items.</p>
          <Button variant="outline" onClick={() => void refetchItems()}>
            Try again
          </Button>
        </div>
      ) : null}

      {!isItemsPending && !isItemsError && tab === "backlog" ? (
        <>
          <form
            onSubmit={handleQuickAdd}
            className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
          >
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Quick add item and press Enter..."
              aria-label="New backlog item"
              className="min-w-48 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Input
              value={targetVersion}
              onChange={(event) => setTargetVersion(event.target.value)}
              aria-label="Target version"
              className="w-32"
            />
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as ProjectItemKind)}
            >
              <SelectTrigger className="w-32" aria-label="Kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              size="icon"
              aria-label="Add item"
              disabled={createItemMutation.isPending || !title.trim()}
            >
              {createItemMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
            </Button>
          </form>

          {backlogGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
              <h2 className="text-lg font-semibold">Backlog is empty</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first item above to plan the next release.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {backlogGroups.map(([version, groupItems]) => (
                <div key={version} className="space-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <span>{version}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {groupItems.length} item
                      {groupItems.length === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <ul className="divide-y rounded-lg border bg-card">
                    {groupItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => toggleStatus(item)}
                          aria-label="Toggle in progress"
                          title="Toggle in progress"
                        >
                          <StatusIcon status={item.status} />
                        </button>
                        <KindChip kind={item.kind} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {item.title}
                        </span>
                        {item.noteId ? (
                          <Link
                            to={`/notes/${item.noteId}`}
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <NotebookPen className="size-3.5" />
                            Note
                          </Link>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Write note"
                            title="Write note"
                            asChild
                          >
                            <Link
                              to={`/notes/new?workspace=${project.workspaceId}&project=${project.id}&projectItem=${item.id}`}
                            >
                              <NotebookPen className="size-4" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setShippingItem(item);
                            setShipVersion(item.targetVersion);
                          }}
                        >
                          <Rocket className="size-3.5" />
                          Ship
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit item"
                          title="Edit item"
                          onClick={() => setEditingItem(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete item"
                          title="Delete item"
                          onClick={() => setDeletingItem(item)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {!isItemsPending && !isItemsError && tab === "changelog" ? (
        changelogGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
            <h2 className="text-lg font-semibold">Nothing shipped yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ship a backlog item to start the changelog.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {changelogGroups.map(([dateLabel, groupItems]) => (
              <div key={dateLabel} className="space-y-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span>{dateLabel}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                  </span>
                </h2>
                <ul className="space-y-2 border-l pl-4">
                  {groupItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <KindChip kind={item.kind} />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm">{item.title}</span>
                        {item.shippedVersion ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="text-muted-foreground/40">|</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                              {item.shippedVersion}
                            </span>
                          </span>
                        ) : null}
                      </div>
                      {item.noteId ? (
                        <Link
                          to={`/notes/${item.noteId}`}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <NotebookPen className="size-3.5" />
                          Note
                        </Link>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          asChild
                        >
                          <Link
                            to={`/notes/new?workspace=${project.workspaceId}&project=${project.id}&projectItem=${item.id}`}
                          >
                            <NotebookPen className="size-3.5" />
                            Write note
                          </Link>
                        </Button>
                      )}
                      {item.bragLogId ? (
                        <Link
                          to={`/brag-logs/${item.bragLogId}`}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Trophy className="size-3.5" />
                          Brag Logged
                        </Link>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() => setBragItem(item)}
                        >
                          <Trophy className="size-3.5" />
                          Log as STAR
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === "notes" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={notesSearch}
              onChange={(event) => {
                setNotesSearch(event.target.value);
                setNotesPage(1);
              }}
              placeholder="Search project notes..."
              aria-label="Search project notes"
              className="w-full sm:min-w-[200px] sm:w-auto sm:flex-1"
            />
            <Button asChild className="shrink-0">
              <Link
                to={`/notes/new?workspace=${project.workspaceId}&project=${project.id}`}
              >
                <NotebookPen className="size-4" />
                New note
              </Link>
            </Button>
          </div>

          {notesQuery.isPending ? <NoteListSkeleton /> : null}

          {notesQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Failed to load notes.
              </p>
              <Button
                variant="outline"
                onClick={() => void notesQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {!notesQuery.isPending &&
          !notesQuery.isError &&
          projectNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <NotebookPen className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">No project notes yet</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Capture architecture decisions, spike findings, or docs for
                  this project.
                </p>
              </div>
              <Button asChild>
                <Link
                  to={`/notes/new?workspace=${project.workspaceId}&project=${project.id}`}
                >
                  <NotebookPen className="size-4" />
                  Create first note
                </Link>
              </Button>
            </div>
          ) : null}

          {!notesQuery.isPending &&
          !notesQuery.isError &&
          projectNotes.length > 0 ? (
            <>
              <NoteList notes={projectNotes} />
              {notesPagination ? (
                <PaginationControls
                  page={notesPagination.page}
                  totalPages={notesPagination.totalPages}
                  onPageChange={setNotesPage}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <ProjectFormDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        workspaceId={workspaceId}
        project={project}
      />

      <ProjectItemFormDialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
        }}
        projectId={projectId}
        item={editingItem}
      />

      <BragLogFormDialog
        open={Boolean(bragItem)}
        onOpenChange={(open) => {
          if (!open) {
            setBragItem(null);
          }
        }}
        workspaceId={project.workspaceId}
        projectItemId={bragItem?.id}
        prefill={
          bragItem
            ? {
                title: bragItem.title,
                situation: `Shipped as part of ${project.name}${
                  bragItem.shippedVersion
                    ? ` (${bragItem.shippedVersion})`
                    : ""
                }.`,
                task: `${KIND_TASK_LABELS[bragItem.kind]}: ${bragItem.title}`,
                action: bragItem.description ?? "",
                result: "",
              }
            : null
        }
      />

      <Dialog
        open={Boolean(shippingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setShippingItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ship item</DialogTitle>
            <DialogDescription>
              Move &ldquo;{shippingItem?.title}&rdquo; to the changelog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="ship-version"
              className="text-sm font-medium"
            >
              Version
            </label>
            <Input
              id="ship-version"
              value={shipVersion}
              onChange={(event) => setShipVersion(event.target.value)}
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShippingItem(null)}
              disabled={shipMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={confirmShip} disabled={shipMutation.isPending}>
              {shipMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Ship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete item</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{deletingItem?.title}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingItem(null)}
              disabled={deleteItemMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteItem}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{project.name}&rdquo; and all its backlog items?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteProjectOpen(false)}
              disabled={deleteProjectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? (
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

const KIND_TASK_LABELS: Record<ProjectItemKind, string> = {
  feat: "Feature",
  fix: "Bug fix",
  perf: "Performance",
  refactor: "Refactor",
  spike: "Research spike",
  docs: "Documentation",
};
