import type { ColumnDef, Row } from "@tanstack/react-table";
import { ShieldCheck, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/client/components/ui/avatar";
import { Button } from "@/client/components/ui/button";
import { DataTableColumnHeader } from "@/client/components/data-table-column-header";
import { formatBytes } from "@/client/lib/attachments";
import type { AdminUser } from "@/shared/schemas/admin";

function getInitials(user: AdminUser): string {
  const source = user.name.trim() || user.email;
  return source.slice(0, 1).toUpperCase();
}

export const USER_COLUMN_LABELS: Record<string, string> = {
  user: "User",
  Workspaces: "Workspaces",
  "Brag logs": "Brag logs",
  Notes: "Notes",
  Sparks: "Sparks",
  Images: "Images",
  Storage: "Storage",
  "AI calls": "AI calls",
  "AI tokens": "AI tokens",
};

function numericCell(
  label: string,
  accessor: (user: AdminUser) => number,
): ColumnDef<AdminUser> {
  return {
    id: label,
    accessorFn: (user) => accessor(user),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={label} />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{accessor(row.original).toLocaleString()}</span>
    ),
  };
}

export function buildUserColumns({
  isSelf,
  onDelete,
}: {
  isSelf: (user: AdminUser) => boolean;
  onDelete: (user: AdminUser) => void;
}): ColumnDef<AdminUser>[] {
  return [
    {
      id: "user",
      accessorFn: (user) => `${user.name} ${user.email}`,
      header: "User",
      enableSorting: true,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              ) : null}
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{user.name}</span>
                {user.isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    <ShieldCheck className="size-3" />
                    Admin
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        );
      },
    },
    numericCell("Workspaces", (user) => user.usage.workspaces),
    numericCell("Brag logs", (user) => user.usage.bragLogs),
    numericCell("Notes", (user) => user.usage.notes),
    numericCell("Sparks", (user) => user.usage.sparks),
    numericCell("Images", (user) => user.usage.attachments),
    {
      id: "Storage",
      accessorFn: (user) => user.usage.storageBytes,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Storage" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatBytes(row.original.usage.storageBytes)}
        </span>
      ),
    },
    numericCell("AI calls", (user) => user.usage.aiCalls),
    numericCell("AI tokens", (user) => user.usage.aiTokens),
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }: { row: Row<AdminUser> }) => {
        const user = row.original;
        const self = isSelf(user);
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            disabled={self}
            aria-label={`Delete ${user.email}`}
            title={self ? "You cannot delete your own account" : "Delete user"}
            onClick={() => onDelete(user)}
          >
            <Trash2 className="size-4" />
          </Button>
        );
      },
    },
  ];
}
