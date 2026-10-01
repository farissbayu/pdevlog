import { useQuery } from "@tanstack/react-query";
import {
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Tags,
} from "lucide-react";
import { useState } from "react";
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
import type { UserResponse } from "@/shared/schemas/auth";

const SIDEBAR_STORAGE_KEY = "pdevlog-sidebar-collapsed";

const navItems: {
  label: string;
  icon: typeof LayoutDashboard;
  to?: string;
}[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Workspaces", icon: FolderKanban, to: "/workspaces" },
  { label: "Tags", icon: Tags, to: "/tags" },
];

function getInitials(user: UserResponse): string {
  const source = user.name.trim() || user.email;
  return source.slice(0, 1).toUpperCase();
}

function UserMenu({
  user,
  align = "end",
  compact = false,
}: {
  user: UserResponse;
  align?: "start" | "end";
  compact?: boolean;
}) {
  const logoutMutation = useLogoutMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact && "justify-center",
          )}
        >
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback>{getInitials(user)}</AvatarFallback>
          </Avatar>
          {!compact ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          ) : null}
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

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-2">
      {navItems.map((item) =>
        item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/"}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        ) : (
          <div
            key={item.label}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center rounded-md text-sm text-muted-foreground",
              collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed ? (
              <>
                <span className="truncate">{item.label}</span>
                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide">
                  Soon
                </span>
              </>
            ) : null}
          </div>
        ),
      )}
    </nav>
  );
}

export function AppLayout() {
  const { data } = useQuery(meQueryOptions);
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
  );
  const user = data?.user;

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-2">
          <img
            src="/pdevlog-icon.png"
            alt="Personal Dev OS"
            className="size-7 shrink-0 rounded-md"
          />
          <span className="font-mono font-semibold tracking-tight">
            Personal Dev OS
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <MobileMenu user={user} />
        </div>
      </header>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b",
            collapsed ? "justify-center px-2" : "gap-2 px-4",
          )}
        >
          <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary">
            <img
              src="/pdevlog-icon.png"
              alt="Personal Dev OS"
              className="size-full object-cover"
            />
          </div>
          {!collapsed ? (
            <span className="truncate font-mono font-semibold tracking-tight">
              Personal Dev OS
            </span>
          ) : null}
        </div>

        <SidebarNav collapsed={collapsed} />

        <div
          className={cn(
            "border-t p-2",
            collapsed
              ? "flex flex-col items-center gap-1"
              : "flex items-center gap-1",
          )}
        >
          <div className={cn("min-w-0", collapsed ? "w-full" : "flex-1")}>
            <UserMenu user={user} align="start" compact={collapsed} />
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>
        </div>
      </aside>

      <main
        className={cn(
          "transition-[padding] duration-200",
          collapsed ? "md:pl-16" : "md:pl-56",
        )}
      >
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
