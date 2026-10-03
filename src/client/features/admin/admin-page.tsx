import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Database,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Loader2,
  SearchX,
  Shield,
  Sparkles,
  Tags as TagsIcon,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/client/components/data-table";
import { DataTableViewOptions } from "@/client/components/data-table-view-options";
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
import { Label } from "@/client/components/ui/label";
import { meQueryOptions } from "@/client/features/auth/api";
import { formatBytes } from "@/client/lib/attachments";
import { useFilterParams } from "@/client/lib/use-filter-params";
import type { AdminUser } from "@/shared/schemas/admin";

import { useAdminUsersQuery, useDeleteAdminUserMutation } from "./api";
import { buildUserColumns, USER_COLUMN_LABELS } from "./columns";
import { usePersistentColumnVisibility } from "./use-column-visibility";

type Totals = {
  users: number;
  workspaces: number;
  bragLogs: number;
  notes: number;
  sparks: number;
  attachments: number;
  storageBytes: number;
  aiCalls: number;
  aiTokens: number;
};

function sumUsage(users: AdminUser[]): Totals {
  return users.reduce<Totals>(
    (acc, user) => ({
      users: acc.users + 1,
      workspaces: acc.workspaces + user.usage.workspaces,
      bragLogs: acc.bragLogs + user.usage.bragLogs,
      notes: acc.notes + user.usage.notes,
      sparks: acc.sparks + user.usage.sparks,
      attachments: acc.attachments + user.usage.attachments,
      storageBytes: acc.storageBytes + user.usage.storageBytes,
      aiCalls: acc.aiCalls + user.usage.aiCalls,
      aiTokens: acc.aiTokens + user.usage.aiTokens,
    }),
    {
      users: 0,
      workspaces: 0,
      bragLogs: 0,
      notes: 0,
      sparks: 0,
      attachments: 0,
      storageBytes: 0,
      aiCalls: 0,
      aiTokens: 0,
    },
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function AdminOverviewPage() {
  const { data, isPending, isError } = useAdminUsersQuery({ page: 1 });

  const totals = useMemo(() => sumUsage(data?.users ?? []), [data?.users]);
  const totalPages = data?.pagination.totalPages ?? 1;

  const cards: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Users, label: "Users", value: totals.users.toLocaleString() },
    {
      icon: FolderKanban,
      label: "Workspaces",
      value: totals.workspaces.toLocaleString(),
    },
    {
      icon: FileText,
      label: "Brag logs",
      value: totals.bragLogs.toLocaleString(),
    },
    { icon: TagsIcon, label: "Notes", value: totals.notes.toLocaleString() },
    {
      icon: Sparkles,
      label: "Sparks",
      value: totals.sparks.toLocaleString(),
    },
    {
      icon: ImageIcon,
      label: "Attachments",
      value: totals.attachments.toLocaleString(),
    },
    {
      icon: Database,
      label: "Storage",
      value: formatBytes(totals.storageBytes),
    },
    { icon: Bot, label: "AI calls", value: totals.aiCalls.toLocaleString() },
    { icon: Bot, label: "AI tokens", value: totals.aiTokens.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Shield className="size-6 text-primary" />
          Admin overview
        </h1>
        <p className="text-sm text-muted-foreground">
          A snapshot of every user and everything they have stored.
        </p>
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="h-[4.5rem] animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Failed to load stats. Please try again.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
          {totalPages > 1 ? (
            <p className="text-xs text-muted-foreground">
              Totals reflect the first page of users. Open the Users tab for the
              full, searchable list.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const filterApi = useFilterParams();
  const { data: me } = useQuery(meQueryOptions);
  const usersQuery = useAdminUsersQuery({
    q: filterApi.filters.q,
    page: filterApi.filters.page,
  });
  const deleteMutation = useDeleteAdminUserMutation();

  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const { columnVisibility, setColumnVisibility } =
    usePersistentColumnVisibility();

  const users = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;
  const isConfirmed =
    deleting !== null &&
    confirmation.trim().toLowerCase() === deleting.email.toLowerCase();

  const columns = useMemo(
    () =>
      buildUserColumns({
        isSelf: (user) => me?.user.id === user.id,
        onDelete: (user) => {
          setDeleting(user);
          setConfirmation("");
        },
      }),
    [me?.user.id],
  );

  const closeDelete = () => {
    setDeleting(null);
    setConfirmation("");
  };

  const confirmDelete = () => {
    if (!deleting || !isConfirmed) {
      return;
    }
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("User deleted");
        closeDelete();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="size-6 text-primary" />
            Users
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage accounts and inspect per-user usage.
          </p>
        </div>
        <SearchInput
          value={filterApi.query}
          onChange={(event) => filterApi.setQuery(event.target.value)}
          placeholder="Search name or email..."
          aria-label="Search users"
          className="w-full sm:w-72"
        />
      </div>

      {usersQuery.isPending ? (
        <div className="space-y-3 rounded-lg border bg-card p-5">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-md bg-muted"
            />
          ))}
        </div>
      ) : usersQuery.isError ? (
        <p className="rounded-lg border bg-card p-5 text-sm text-destructive">
          Failed to load users. Please try again.
        </p>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          <SearchX className="size-6" />
          <p className="text-sm">No users found.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          visibility={columnVisibility}
          onVisibilityChange={setColumnVisibility}
          toolbar={(table) => (
            <DataTableViewOptions
              table={table}
              labels={USER_COLUMN_LABELS}
            />
          )}
        />
      )}

      {pagination && pagination.totalPages > 1 ? (
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={filterApi.setPage}
        />
      ) : null}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDelete();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {deleting?.email}
              </span>{" "}
              and all of their data. Type the email to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="admin-delete-confirmation">Confirmation</Label>
            <Input
              id="admin-delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={deleting?.email}
              autoComplete="off"
            />
          </div>

          {deleteMutation.isError ? (
            <p className="text-sm text-destructive">
              Failed to delete user. Please try again.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDelete}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!isConfirmed || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
