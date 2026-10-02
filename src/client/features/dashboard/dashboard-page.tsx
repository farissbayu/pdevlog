import {
  AlertTriangle,
  BookOpen,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Link } from "react-router";

import { Button } from "@/client/components/ui/button";
import { TagChip } from "@/client/features/brag-logs/tag-chip";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";
import type { ActivityItem } from "@/shared/schemas/dashboard";
import { useDashboardQuery, useRecentActivityQuery } from "./api";

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
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
        <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
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

function ActivityRow({ item }: { item: ActivityItem }) {
  const config =
    item.type === "brag-log"
      ? {
          Icon: Trophy,
          href: `/brag-logs/${item.id}`,
          label: "Brag Log",
          className:
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        }
      : item.type === "note"
        ? {
            Icon: BookOpen,
            href: `/notes/${item.id}`,
            label: "Note",
            className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          }
        : {
            Icon: Sparkles,
            href: "/sparks",
            label: "Spark",
            className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
          };
  const Icon = config.Icon;

  return (
    <li>
      <Link
        to={config.href}
        className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-accent"
      >
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
            config.className,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatActivityDate(item.date)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono uppercase tracking-wide">
              {config.label}
            </span>
            {item.workspace ? (
              <>
                <WorkspaceTypeBadge type={item.workspace.type} />
                <span className="truncate">{item.workspace.name}</span>
              </>
            ) : null}
          </div>
          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <ul className="divide-y">
      {[0, 1, 2].map((index) => (
        <li key={index} className="flex items-start gap-4 px-5 py-4">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-21 animate-pulse rounded-lg border bg-card"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        </div>
        <ActivitySkeleton />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const dashboard = useDashboardQuery();
  const activity = useRecentActivityQuery();

  const stats: StatCard[] = dashboard.data
    ? [
        {
          label: "Workspaces",
          value: dashboard.data.stats.workspaces,
          icon: FolderKanban,
          to: "/workspaces",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        },
        {
          label: "Brag Logs",
          value: dashboard.data.stats.bragLogs,
          icon: FileText,
          to: "/brag-logs",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        },
        {
          label: "Notes",
          value: dashboard.data.stats.notes,
          icon: GraduationCap,
          to: "/notes",
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        },
        {
          label: "Sparks",
          value: dashboard.data.stats.sparks,
          icon: Sparkles,
          to: "/sparks",
          className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        },
      ]
    : [];

  const isPending = dashboard.isPending || activity.isPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LayoutDashboard className="size-6 text-primary" />
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Your latest activity at a glance.
        </p>
      </div>

      {isPending ? <DashboardSkeleton /> : null}

      {activity.isError ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Something went wrong while loading your activity.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void dashboard.refetch();
              void activity.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {!isPending && !activity.isError ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-medium">Recent activity</h2>
              <p className="text-sm text-muted-foreground">
                Your latest brag logs, notes, and sparks.
              </p>
            </div>

            {activity.data && activity.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Trophy className="size-5 text-muted-foreground" />
                </div>
                <p className="max-w-sm text-sm text-muted-foreground">
                  No activity yet. Start by logging a brag log or a note!
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button asChild size="sm">
                    <Link to="/brag-logs">Log a brag</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/notes">Write a note</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {activity.data?.map((item) => (
                  <ActivityRow
                    key={`${item.type}-${item.id}`}
                    item={item}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
