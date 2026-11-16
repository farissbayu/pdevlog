import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "cn";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/client/components/ui/avatar";
import { Button } from "@/client/components/ui/button";
import { meQueryOptions } from "@/client/features/auth/api";
import { TagChip } from "@/client/features/brag-logs/tag-chip";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";
import type { ActivityItem } from "@/shared/schemas/dashboard";
import {
  useCheckInsQuery,
  useDashboardQuery,
  useRecentActivityQuery,
} from "./api";
import { FirstAchievementCard } from "./first-achievement-card";

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitials(user: { name: string; email: string }): string {
  const source = user.name.trim() || user.email;
  return source.slice(0, 1).toUpperCase();
}

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
      <div className="h-28 animate-pulse rounded-lg border bg-card" />
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
  const checkIns = useCheckInsQuery();
  const me = useQuery(meQueryOptions);

  const user = me.data?.user;
  const days = checkIns.data?.days ?? [];
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayTotal = days.find((day) => day.date === todayKey)?.total ?? 0;
  const weekStartKey = format(startOfWeek(new Date()), "yyyy-MM-dd");
  const weekTotal = days
    .filter((day) => day.date >= weekStartKey)
    .reduce((sum, day) => sum + day.total, 0);
  const stats = dashboard.data?.stats;

  const firstName = user?.name.trim().split(/\s+/)[0] || "there";
  const subtitle = checkIns.isPending
    ? "Here is where your week stands."
    : days.length === 0
      ? "Nothing logged yet — your first entry starts the record."
      : todayTotal > 0
        ? `${countLabel(todayTotal, "entry")} today · ${countLabel(weekTotal, "thing")} this week.`
        : `${countLabel(weekTotal, "thing")} logged this week.`;

  const isPending = dashboard.isPending || activity.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {user?.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.name} />
          ) : null}
          <AvatarFallback>{user ? getInitials(user) : "?"}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {greetingForHour(new Date().getHours())}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
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
          <section className="rounded-lg border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  This week
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {countLabel(weekTotal, "entry")} logged
                </p>
                <p className="text-sm text-muted-foreground">
                  {countLabel(stats?.achievements ?? 0, "achievement")} ·{" "}
                  {countLabel(stats?.skillsEvidenced ?? 0, "skill")} evidenced ·{" "}
                  {countLabel(stats?.sparksInbox ?? 0, "open spark")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/week">
                    Open week recap
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/brag-logs">Log a win</Link>
                </Button>
              </div>
            </div>
          </section>

          {stats && stats.achievements === 0 ? <FirstAchievementCard /> : null}

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-medium">Recent activity</h2>
              <p className="text-sm text-muted-foreground">
                What you've been building, most recent first.
              </p>
            </div>

            {activity.data && activity.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Trophy className="size-5 text-muted-foreground" />
                </div>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Nothing here yet. One win is enough to start — log it before
                  you forget.
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
                  <ActivityRow key={`${item.type}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
