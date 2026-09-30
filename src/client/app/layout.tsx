import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Tags,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/client/components/ui/avatar";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { meQueryOptions, useLogoutMutation } from "@/client/features/auth/api";
import { useWorkspacesQuery } from "@/client/features/workspaces/api";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";
import type { UserResponse } from "@/shared/schemas/auth";

const navItems: {
  label: string;
  icon: typeof LayoutDashboard;
  to?: string;
}[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Workspaces", icon: FolderKanban, to: "/workspaces" },
  { label: "Brag Logs", icon: FileText },
  { label: "Learning Notes", icon: GraduationCap },
  { label: "Tags", icon: Tags },
];

function getInitials(user: UserResponse): string {
  const source = user.name.trim() || user.email;
  return source.slice(0, 1).toUpperCase();
}

function UserMenu({
  user,
  align = "end",
}: {
  user: UserResponse;
  align?: "start" | "end";
}) {
  const logoutMutation = useLogoutMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback>{getInitials(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav() {
  const { data: workspaces, isPending } = useWorkspacesQuery();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {navItems.map((item) =>
        item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </NavLink>
        ) : (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground"
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
            <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide">
              Soon
            </span>
          </div>
        ),
      )}

      <div className="pt-4">
        <p className="px-3 pb-2 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Your workspaces
        </p>

        {isPending ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : null}

        {!isPending && workspaces && workspaces.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No workspaces yet.
          </p>
        ) : null}

        {!isPending && workspaces && workspaces.length > 0 ? (
          <div className="space-y-0.5">
            {workspaces.map((workspace) => (
              <NavLink
                key={workspace.id}
                to="/workspaces"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <span className="truncate">{workspace.name}</span>
                <WorkspaceTypeBadge
                  type={workspace.type}
                  className="ml-auto shrink-0"
                />
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

export function AppLayout() {
  const { data } = useQuery(meQueryOptions);
  const user = data?.user;

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <span className="font-mono font-semibold tracking-tight">
          Personal Dev OS
        </span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <MobileMenu user={user} />
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
            PD
          </div>
        <span className="font-mono font-semibold tracking-tight">
          Personal Dev OS
        </span>
        </div>
        <SidebarNav />
        <div className="flex items-center gap-2 border-t p-3">
          <div className="min-w-0 flex-1">
            <UserMenu user={user} align="start" />
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-5xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function MobileMenu({ user }: { user: UserResponse }) {
  const logoutMutation = useLogoutMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {navItems.map((item) =>
          item.to ? (
            <DropdownMenuItem key={item.label} asChild>
              <Link to={item.to}>
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} disabled>
              <item.icon className="size-4" />
              <span>{item.label}</span>
              <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">
                Soon
              </span>
            </DropdownMenuItem>
          ),
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
