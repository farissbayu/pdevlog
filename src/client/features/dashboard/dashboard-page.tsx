import {
  AlertTriangle,
  FileText,
  FolderKanban,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/client/components/ui/button";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";
import { useDashboardQuery } from "./api";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "unknown";
  }
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type StatCard = {
  label: string;
  value: number;
  icon: LucideIcon;
  to?: string;
  className: string;
  soon?: boolean;
};

function StatCard({ stat }: { stat: StatCard }) {
  const Icon = stat.icon;
  const content = (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${stat.className}`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
          {stat.soon ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Soon
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm text-muted-foreground">{stat.label}</p>
      </div>
    </div>
  );

  if (stat.to) {
    return (
      <Link to={stat.to} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-21 animate-pulse rounded-lg border bg-card"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg border bg-card" />
    </div>
  );
}

export function DashboardPage() {
  const { data, isPending, isError, refetch } = useDashboardQuery();

  const stats: StatCard[] = data
    ? [
        {
          label: "Workspaces",
          value: data.stats.workspaces,
          icon: FolderKanban,
          to: "/workspaces",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        },
        {
          label: "Brag Logs",
          value: data.stats.bragLogs,
          icon: FileText,
          to: "/brag-logs",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        },
        {
          label: "Learning Notes",
          value: data.stats.learningNotes,
          icon: GraduationCap,
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          soon: true,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your activity at a glance.
        </p>
      </div>

      {isPending ? <DashboardSkeleton /> : null}

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Something went wrong while loading your summary.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-medium">Recently edited</h2>
              <p className="text-sm text-muted-foreground">
                Workspaces you touched most recently.
              </p>
            </div>

            {data.recentWorkspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <FolderKanban className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No workspaces yet. Create one to get started.
                </p>
                <Button asChild size="sm">
                  <Link to="/workspaces">Go to workspaces</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {data.recentWorkspaces.map((workspace) => (
                  <li key={workspace.id}>
                    <Link
                      to={`/workspaces/${workspace.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="truncate text-sm font-medium">
                          {workspace.name}
                        </span>
                        <WorkspaceTypeBadge type={workspace.type} />
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(workspace.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
