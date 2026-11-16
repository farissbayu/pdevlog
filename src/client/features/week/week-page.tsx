import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Target,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";
import { EMPTY_FILTERS } from "@/client/lib/use-filter-params";
import { useBragLogsQuery } from "@/client/features/brag-logs/api";
import { TagChip } from "@/client/features/brag-logs/tag-chip";
import { useCheckInsQuery } from "@/client/features/dashboard/api";
import { useCreateSparkMutation } from "@/client/features/sparks/api";
import { bulletLine } from "@/shared/format/bullets";

import {
  parseDayKey,
  shiftWeekKey,
  weekKeyFor,
  weekRangeFor,
} from "./week-range";

const WEEK_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const thisWeekKey = weekKeyFor(new Date());
  const requested = searchParams.get("w");
  const weekKey =
    requested && WEEK_KEY_PATTERN.test(requested) ? requested : thisWeekKey;
  const { start, end } = weekRangeFor(parseDayKey(weekKey));
  const isCurrentWeek = weekKey === thisWeekKey;

  const logs = useBragLogsQuery({ ...EMPTY_FILTERS, from: start, to: end });
  const checkIns = useCheckInsQuery();
  const createSpark = useCreateSparkMutation();
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);

  const entries = logs.data?.bragLogs ?? [];
  const bullets = entries.map((log) =>
    bulletLine(log, log.tags.map((tag) => tag.name)),
  );
  const dayTotals = new Map(
    (checkIns.data?.days ?? []).map((day) => [day.date, day.total]),
  );

  const goToWeek = (nextKey: string) => {
    setSearchParams(nextKey === thisWeekKey ? {} : { w: nextKey });
    setCopied(false);
  };

  const copyBullets = async () => {
    try {
      await navigator.clipboard.writeText(bullets.join("\n"));
      setCopied(true);
      toast.success("Bullets copied");
    } catch {
      toast.error("Could not copy — select the text manually");
    }
  };

  const saveTarget = () => {
    const content = target.trim();
    if (content.length < 4) {
      return;
    }
    createSpark.mutate(
      { content: `Next week target: ${content}` },
      {
        onSuccess: () => {
          setTarget("");
          toast.success("Target saved to Sparks");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const rangeLabel = `${format(parseDayKey(start), "d MMM")} – ${format(parseDayKey(end), "d MMM yyyy")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Week recap</h1>
          <p className="text-sm text-muted-foreground">
            {rangeLabel}
            {isCurrentWeek ? " · in progress" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => goToWeek(shiftWeekKey(weekKey, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant={isCurrentWeek ? "secondary" : "ghost"}
            size="sm"
            onClick={() => goToWeek(thisWeekKey)}
          >
            This week
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next week"
            disabled={isCurrentWeek}
            onClick={() => goToWeek(shiftWeekKey(weekKey, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5" aria-label="Activity this week">
        {DAY_LABELS.map((label, index) => {
          const key = format(addDays(parseDayKey(start), index), "yyyy-MM-dd");
          const total = dayTotals.get(key) ?? 0;
          const isToday = key === format(new Date(), "yyyy-MM-dd");
          return (
            <div
              key={label}
              className={
                isToday
                  ? "rounded-md border border-primary/40 bg-primary/5 px-2 py-2 text-center"
                  : "rounded-md border px-2 py-2 text-center"
              }
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {total > 0 ? total : "—"}
              </p>
            </div>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="space-y-1">
            <h2 className="font-medium">
              {entries.length === 1
                ? "1 win worth writing down"
                : `${entries.length} wins worth writing down`}
            </h2>
            <p className="text-sm text-muted-foreground">
              One line per entry — paste three into a standup, a review, or your
              CV.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyBullets()}
              disabled={bullets.length === 0}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy bullets"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/export/brag-logs?format=bullets&from=${start}&to=${end}`}
                download
              >
                <Download className="size-4" />
                Download .md
              </a>
            </Button>
          </div>
        </div>

        {logs.isPending ? (
          <div className="space-y-2 p-5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        ) : logs.isError ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load this week.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void logs.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              Nothing logged this week. One win is enough — write it before the
              details fade.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link to="/brag-logs">Log a win</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ol className="divide-y">
            {entries.map((log) => (
              <li key={log.id} className="px-5 py-3">
                <Link
                  to={`/brag-logs/${log.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {log.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{log.occurredAt}</span>
                  {log.tags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}

        {entries.length > 0 ? (
          <div className="border-t bg-muted/30 px-5 py-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Ready to paste
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {bullets.join("\n")}
            </pre>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Target className="size-4 text-primary" />
          One target for next week
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What do you want to be able to write down next Friday? Saved to Sparks
          so it comes back when it matters.
        </p>
        <div className="mt-3 space-y-2">
          <Textarea
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            rows={2}
            className="resize-none"
            placeholder="e.g. Ship the caching layer and measure the p95 before/after."
            aria-label="Target for next week"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={saveTarget}
              disabled={target.trim().length < 4 || createSpark.isPending}
            >
              {createSpark.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Save target
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
