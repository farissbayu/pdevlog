import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { cn } from "cn";

import { Button } from "@/client/components/ui/button";
import type { CheckInDay } from "@/shared/schemas/check-in";
import { useCheckInsQuery } from "./api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function intensityClass(total: number): string {
  if (total >= 4) return "bg-primary text-primary-foreground";
  if (total === 3) return "bg-primary/70 text-primary-foreground";
  if (total === 2) return "bg-primary/45 text-foreground";
  if (total === 1) return "bg-primary/20 text-foreground";
  return "bg-muted/40 text-muted-foreground";
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function describeDay(date: Date, day: CheckInDay | undefined): string {
  const label = format(date, "MMM d, yyyy");
  if (!day) {
    return `${label} · no activity`;
  }

  const parts: string[] = [];
  if (day.bragLogs > 0) parts.push(countLabel(day.bragLogs, "brag log"));
  if (day.notes > 0) parts.push(countLabel(day.notes, "note"));
  if (day.sparks > 0) parts.push(countLabel(day.sparks, "spark"));
  if (day.projectItems > 0) {
    parts.push(countLabel(day.projectItems, "shipped item"));
  }

  return `${label} · ${countLabel(day.total, "activity")} (${parts.join(", ")})`;
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background/50 px-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          className,
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function CheckInSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-44 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-5 space-y-1.5">
        {[0, 1, 2, 3, 4].map((week) => (
          <div key={week} className="grid grid-cols-7 gap-1.5">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="mx-auto aspect-square w-full max-w-8 animate-pulse rounded-full bg-muted"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckInError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-4 text-destructive" />
        </span>
        <div>
          <p className="text-sm font-medium">Failed to load check-ins</p>
          <p className="text-xs text-muted-foreground">
            Your activity calendar could not be loaded.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function CheckInCard() {
  const checkIns = useCheckInsQuery();
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => checkIns.data?.days ?? [], [checkIns.data]);

  const dayMap = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );

  const weeks = useMemo(() => {
    const interval = eachDayOfInterval({
      start: startOfWeek(startOfMonth(monthCursor)),
      end: endOfWeek(endOfMonth(monthCursor)),
    });
    const rows: Date[][] = [];
    for (let index = 0; index < interval.length; index += 7) {
      rows.push(interval.slice(index, index + 7));
    }
    return rows;
  }, [monthCursor]);

  if (checkIns.isPending) {
    return <CheckInSkeleton />;
  }

  if (checkIns.isError) {
    return <CheckInError onRetry={() => void checkIns.refetch()} />;
  }

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const monthKey = format(monthCursor, "yyyy-MM");
  const monthLabel = format(monthCursor, "MMMM yyyy");
  const activeThisMonth = days.filter((day) =>
    day.date.startsWith(monthKey),
  ).length;
  const daysInMonth = endOfMonth(monthCursor).getDate();
  const isCurrentMonth = isSameMonth(monthCursor, new Date());
  const { currentStreak, longestStreak, todayActive } = checkIns.data;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-medium">
            <CalendarCheck className="size-4 text-primary" />
            Daily Check-In
          </h2>
          <p className="text-sm text-muted-foreground">
            Brag logs, notes, sparks, and shipped items you create each day.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonthCursor((cursor) => addMonths(cursor, -1))}
          >
            <ChevronLeft />
          </Button>
          <span
            className="min-w-28 text-center text-sm font-medium"
            aria-live="polite"
          >
            {monthLabel}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={isCurrentMonth}
            onClick={() => setMonthCursor((cursor) => addMonths(cursor, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div aria-label={`Activity in ${monthLabel}`}>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_LABELS.map((label) => (
              <span
                key={label}
                className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-1.5 space-y-1.5">
            {weeks.map((week) => (
              <div key={week[0].toISOString()} className="grid grid-cols-7 gap-1.5">
                {week.map((date) => {
                  const key = format(date, "yyyy-MM-dd");
                  const day = dayMap.get(key);
                  const isToday = key === todayKey;
                  const label = describeDay(date, day);
                  return (
                    <div key={key} className="flex items-center justify-center">
                      <div
                        title={label}
                        aria-label={label}
                        className={cn(
                          "flex aspect-square w-full max-w-8 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                          intensityClass(day?.total ?? 0),
                          !isSameMonth(date, monthCursor) && "opacity-40",
                          isToday &&
                            (day
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "border border-dashed border-primary/40 bg-transparent text-muted-foreground"),
                        )}
                      >
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={cn(
                  "size-2.5 rounded-full",
                  intensityClass(level),
                )}
              />
            ))}
            <span>More</span>
          </div>

          {days.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No activity yet — write a spark to start your streak.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col justify-center gap-3">
          <SummaryRow
            icon={Flame}
            label="Current streak"
            value={countLabel(currentStreak, "day")}
            className="bg-orange-500/10 text-orange-600 dark:text-orange-400"
          />
          <SummaryRow
            icon={Trophy}
            label="Best streak"
            value={countLabel(longestStreak, "day")}
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <SummaryRow
            icon={CalendarCheck}
            label="This month"
            value={`${activeThisMonth} / ${daysInMonth} days`}
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          {!todayActive ? (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/sparks">
                Nothing logged today — write a spark
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
