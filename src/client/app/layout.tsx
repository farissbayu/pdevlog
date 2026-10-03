import { useQuery } from "@tanstack/react-query";
import {
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sparkles,
  Tags,
  Users,
  type LucideIcon,
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
import { SparksProvider } from "@/client/features/sparks/sparks-provider";
import type { UserResponse } from "@/shared/schemas/auth";

const SIDEBAR_STORAGE_KEY = "pdevlog-sidebar-collapsed";
const ADMIN_SIDEBAR_STORAGE_KEY = "pdevlog-admin-sidebar-collapsed";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  exact?: boolean;
};

const appNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", exact: true },
  { label: "Workspaces", icon: FolderKanban, to: "/workspaces" },
  { label: "Brag Logs", icon: FileText, to: "/brag-logs" },
  { label: "Sparks", icon: Sparkles, to: "/sparks" },
  { label: "Tags", icon: Tags, to: "/tags" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

const adminNavItems: NavItem[] = [
  { label: "Overview", icon: Shield, to: "/admin", exact: true },
  { label: "Users", icon: Users, to: "/admin/users" },
];

type SidebarMode = "app" | "admin";

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

function SidebarNav({
  collapsed,
  items,
}: {
  collapsed: boolean;
  items: NavItem[];
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-2">
      {items.map((item) =>
        item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.exact}
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

function BrandMark({
  collapsed,
  mode,
}: {
  collapsed: boolean;
  mode: SidebarMode;
}) {
  return (
    <div
      className={cn(
        "flex h-14 items-center border-b",
        collapsed ? "justify-center px-2" : "gap-2 px-4",
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary">
        <img
          src="/pdevlog-icon.png"
          alt="Personal Dev Log"
          className="size-full object-cover"
        />
      </div>
      {!collapsed ? (
        <span className="truncate font-mono font-semibold tracking-tight">
          {mode === "admin" ? "Admin Console" : "Personal Dev Log"}
        </span>
      ) : null}
    </div>
  );
}

function SidebarChrome({
  user,
  collapsed,
  toggleCollapsed,
  mode,
  items,
}: {
  user: UserResponse;
  collapsed: boolean;
  toggleCollapsed: () => void;
  mode: SidebarMode;
  items: NavItem[];
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 hidden flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <BrandMark collapsed={collapsed} mode={mode} />
      <SidebarNav collapsed={collapsed} items={items} />

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
  );
}

function MobileHeader({
  user,
  mode,
}: {
  user: UserResponse;
  mode: SidebarMode;
}) {
  const logoutMutation = useLogoutMutation();
  const items = mode === "admin" ? adminNavItems : appNavItems;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
      <div className="flex items-center gap-2">
        <img
          src="/pdevlog-icon.png"
          alt="Personal Dev Log"
          className="size-7 shrink-0 rounded-md"
        />
        <span className="font-mono font-semibold tracking-tight">
          {mode === "admin" ? "Admin Console" : "Personal Dev Log"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {items.map((item) =>
              item.to ? (
                <DropdownMenuItem key={item.label} asChild>
                  <Link to={item.to}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ) : null,
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="truncate">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuItem
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function useCollapsedState(storageKey: string) {
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(storageKey) === "true",
  );

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  };

  return { collapsed, toggleCollapsed };
}

export function AppLayout() {
  const { data } = useQuery(meQueryOptions);
  const { collapsed, toggleCollapsed } = useCollapsedState(SIDEBAR_STORAGE_KEY);
  const user = data?.user;

  if (!user) {
    return null;
  }

  return (
    <SparksProvider>
      <div className="min-h-svh bg-background">
        <MobileHeader user={user} mode="app" />

        <SidebarChrome
          user={user}
          collapsed={collapsed}
          toggleCollapsed={toggleCollapsed}
          mode="app"
          items={appNavItems}
        />

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
    </SparksProvider>
  );
}

export function AdminLayout() {
  const { data } = useQuery(meQueryOptions);
  const { collapsed, toggleCollapsed } = useCollapsedState(
    ADMIN_SIDEBAR_STORAGE_KEY,
  );
  const user = data?.user;

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-svh bg-background">
      <MobileHeader user={user} mode="admin" />

      <SidebarChrome
        user={user}
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
        mode="admin"
        items={adminNavItems}
      />

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
