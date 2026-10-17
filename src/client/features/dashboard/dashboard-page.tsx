import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Flame,
  FolderKanban,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/client/components/ui/avatar";
import { Button } from "@/client/components/ui/button";
import { meQueryOptions } from "@/client/features/auth/api";
import { TagChip } from "@/client/features/brag-logs/tag-chip";
import { profileQueryOptions } from "@/client/features/profile/api";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";
import type { ActivityItem } from "@/shared/schemas/dashboard";
import {
  useCheckInsQuery,
  useDashboardQuery,
  useRecentActivityQuery,
} from "./api";
import { CheckInCard } from "./check-in-card";


function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitials(name: string, email: string): string {
  const source = name.trim() || email;
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
  const checkIns = useCheckInsQuery();
  const profileQuery = useQuery(profileQueryOptions());
  const me = useQuery(meQueryOptions);
  const insights = profileQuery.data?.skillInsights;

  const user = me.data?.user;
  const days = checkIns.data?.days ?? [];
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayTotal = days.find((day) => day.date === todayKey)?.total ?? 0;
  const weekStartKey = format(startOfWeek(new Date()), "yyyy-MM-dd");
  const weekTotal = days
    .filter((day) => day.date >= weekStartKey)
    .reduce((sum, day) => sum + day.total, 0);
  const currentStreak = checkIns.data?.currentStreak ?? 0;
  const topStrength = insights?.strengths[0]?.area;

  const firstName = user?.name.trim().split(/\s+/)[0] || "there";
  const subtitle = checkIns.isPending
    ? "Here is where your week stands."
    : days.length === 0
      ? "Nothing logged yet — your first entry starts the habit."
      : todayTotal > 0
        ? `${countLabel(todayTotal, "entry")} today · ${countLabel(currentStreak, "day")} streak.`
        : currentStreak > 0
          ? `Nothing logged today — your ${countLabel(currentStreak, "day")} streak is safe.`
          : "Nothing logged today yet — add one to keep the habit going.";
  const wrapUp =
    days.length === 0
      ? "Log a brag, a note, or a spark and this is where your progress will gather."
      : `${countLabel(weekTotal, "thing")} logged this week${topStrength ? `, leaning into ${topStrength}` : ""}.`;

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback>
              {user ? getInitials(user.name, user.email) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              {greetingForHour(new Date().getHours())}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/guides" target="_blank" rel="noreferrer">
            <BookOpen className="size-4 text-primary" />
            <span>Guides</span>
          </Link>
        </Button>
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
          {checkIns.isPending ? (
            <div className="h-[104px] animate-pulse rounded-lg border bg-card" />
          ) : (
            <div className="relative overflow-hidden rounded-lg border bg-card p-5 sm:p-6">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"
                aria-hidden
              />
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Flame className="size-6" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-2xl font-semibold tabular-nums">
                      {countLabel(currentStreak, "day")} streak
                    </p>
                    <p className="text-sm text-muted-foreground">{wrapUp}</p>
                  </div>
                </div>
                {insights ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {insights.archetype}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </div>

          <CheckInCard />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Recent Activity */}
            <div className="overflow-hidden rounded-lg border bg-card lg:col-span-8">

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
                    <ActivityRow
                      key={`${item.type}-${item.id}`}
                      item={item}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Skill & Competency Insights Snapshot */}
            <div className="flex flex-col rounded-lg border bg-card p-5 lg:col-span-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="font-medium text-sm">Competency Snapshot</h2>
                </div>
                {insights && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
                    {insights.archetype}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-center py-4 space-y-3">
                {insights ? (
                  <>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {insights.summary}
                    </p>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Top Superpowers
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {insights.strengths.slice(0, 3).map((s, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                          >
                            {s.area}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Growth Focus
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {insights.growthAreas.slice(0, 2).map((g, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                          >
                            {g.area}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                    <Sparkles className="size-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground max-w-[220px]">
                      Your technical superpowers and growth areas show up here
                      once you analyze your CV in Profile.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <Link to="/profile?tab=skills">
                    <Sparkles className="size-3.5" />
                    {insights ? "View Full Competency Analysis" : "Analyze Skills in Profile"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

