import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FolderKanban,
  Lightbulb,
  Loader2,
  PencilLine,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/client/components/ui/button";
import { useCreateSparkMutation } from "@/client/features/sparks/api";
import type {
  DailyLearningSuggestion,
  SuggestionSourceKind,
} from "@/shared/schemas/learning-suggestion";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  useGenerateLearningSuggestionMutation,
  useLearningSuggestionQuery,
  useRegenerateLearningSuggestionMutation,
  useUpdateLearningSuggestionStatusMutation,
} from "./api";

const SOURCE_ICONS: Record<SuggestionSourceKind, LucideIcon> = {
  "brag-log": Trophy,
  note: BookOpen,
  "project-item": FolderKanban,
};

function SuggestionSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="h-4 w-44 animate-pulse rounded bg-muted" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-16 animate-pulse rounded bg-muted" />
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
    </div>
  );
}

function StatusBadge({ suggestion }: { suggestion: DailyLearningSuggestion }) {
  if (suggestion.status === "saved_as_spark") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400">
        <CheckCircle2 className="size-3" />
        Saved to Sparks
      </span>
    );
  }
  if (suggestion.status === "converted_to_note") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" />
        Note started
      </span>
    );
  }
  return null;
}

export function DailyLearningCard() {
  const query = useLearningSuggestionQuery();
  const generate = useGenerateLearningSuggestionMutation();
  const regenerate = useRegenerateLearningSuggestionMutation();
  const updateStatus = useUpdateLearningSuggestionStatusMutation();
  const createSpark = useCreateSparkMutation();
  const navigate = useNavigate();

  const suggestion = query.data?.suggestion ?? null;
  const regenerationsLeft = query.data?.regenerationsLeft ?? 0;
  const hasRecentActivity = query.data?.hasRecentActivity ?? true;

  const onMutationError = (error: Error) => {
    toast.error(error.message);
  };

  const handleGenerate = () => {
    generate.mutate(undefined, {
      onError: onMutationError,
      onSuccess: () => toast.success("Today's suggestion is ready"),
    });
  };

  const handleRegenerate = () => {
    regenerate.mutate(undefined, {
      onError: onMutationError,
      onSuccess: () => toast.success("Fresh suggestion ready"),
    });
  };

  const handleSaveAsSpark = () => {
    if (!suggestion) return;
    createSpark.mutate(
      {
        content: `[Learning Spike] ${suggestion.title}: ${suggestion.practicalNextStep}`,
      },
      {
        onError: onMutationError,
        onSuccess: () => {
          updateStatus.mutate({ id: suggestion.id, status: "saved_as_spark" });
          toast.success("Saved to your Sparks inbox!");
        },
      },
    );
  };

  const handleStartNote = () => {
    if (!suggestion) return;
    updateStatus.mutate({ id: suggestion.id, status: "converted_to_note" });

    const params = new URLSearchParams({ title: suggestion.title });
    if (suggestion.suggestedTags.length > 0) {
      params.set("tags", suggestion.suggestedTags.join(","));
    }
    if (suggestion.suggestedOutline) {
      params.set("content", suggestion.suggestedOutline);
    }
    navigate(`/notes/new?${params.toString()}`);
  };

  if (query.isPending) {
    return <SuggestionSkeleton />;
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-5 text-center">
        <AlertTriangle className="size-5 text-destructive" />
        <p className="text-xs text-muted-foreground">
          Failed to load today's learning suggestion.
        </p>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between border-b pb-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 text-primary" />
        <h2 className="text-sm font-medium">Today's Learning Suggestion</h2>
      </div>
      {suggestion ? <StatusBadge suggestion={suggestion} /> : null}
    </div>
  );

  if (!suggestion) {
    const busy = generate.isPending;
    return (
      <div className="flex flex-col rounded-lg border bg-card p-5">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <Sparkles className="size-8 text-muted-foreground/40" />
          {hasRecentActivity ? (
            <p className="max-w-[240px] text-xs text-muted-foreground">
              Turn your last 7 days of work into one high-leverage topic to
              learn today.
            </p>
          ) : (
            <p className="max-w-[240px] text-xs text-muted-foreground">
              No dev activity logged in the last 7 days. Log a brag, note, or
              project item for hyper-relevant suggestions, or start with a
              foundational topic.
            </p>
          )}
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            disabled={busy}
            onClick={handleGenerate}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {hasRecentActivity ? "Get today's suggestion" : "Suggest a starter topic"}
          </Button>
        </div>
      </div>
    );
  }

  const savedAsSpark = suggestion.status === "saved_as_spark";

  return (
    <div className="flex flex-col rounded-lg border bg-card p-5">
      {header}

      <div className="flex flex-1 flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-primary">
            {suggestion.category}
          </span>
        </div>

        <h3 className="text-sm font-semibold leading-snug">
          {suggestion.title}
        </h3>

        <div className="rounded-md border-l-2 border-primary/50 bg-muted/40 px-3 py-2.5 space-y-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Lightbulb className="size-3" />
            Why this
          </span>
          <p className="text-xs leading-relaxed">{suggestion.reason}</p>
          {suggestion.sourceItems.length === 0 &&
          suggestion.sourceContextSummary ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground italic">
              {suggestion.sourceContextSummary}
            </p>
          ) : null}
          {suggestion.sourceItems.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Based on
              </span>
              {suggestion.sourceItems.map((source) => {
                const Icon = SOURCE_ICONS[source.kind];
                return (
                  <span
                    key={`${source.kind}-${source.title}`}
                    className="inline-flex items-center gap-1 rounded-md border bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                  >
                    <Icon className="size-3 text-muted-foreground" />
                    {source.title}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border-l-2 border-primary/50 bg-muted/40 px-3 py-2.5 space-y-1">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Target className="size-3" />
            Practical next step
          </span>
          <p className="text-xs leading-relaxed">{suggestion.practicalNextStep}</p>
        </div>

        {suggestion.suggestedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {suggestion.suggestedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={createSpark.isPending}
            onClick={handleSaveAsSpark}
          >
            <Zap className="size-3.5" />
            {savedAsSpark ? "Saved as Spark" : "Save as Spark"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handleStartNote}
          >
            <PencilLine className="size-3.5" />
            Start Note
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs"
          disabled={regenerationsLeft <= 0 || regenerate.isPending}
          title={
            regenerationsLeft <= 0
              ? "Daily limit reached (3/3 regenerations used). Resets tomorrow."
              : undefined
          }
          onClick={handleRegenerate}
        >
          {regenerate.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Regenerate ({regenerationsLeft} left today)
        </Button>
        <span className="text-[10px] text-muted-foreground">
          Resets at midnight
        </span>
      </div>
    </div>
  );
}
