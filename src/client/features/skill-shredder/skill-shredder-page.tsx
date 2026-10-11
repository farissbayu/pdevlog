import {
  GraduationCap,
  Loader2,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { cn } from "cn";
import { toast } from "sonner";

import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";
import { useNoteDetailQuery } from "@/client/features/notes/api";
import { useSparkDetailQuery } from "@/client/features/sparks/api";
import { sparkTitle } from "@/shared/schemas/spark";
import {
  noteToShredContext,
  skillShredderInputSchema,
  type SkillShredderResult,
  type SkillShredResponse,
  type SkillShredStatus,
} from "@/shared/schemas/skill-shredder";

import {
  useCreateSkillShredMutation,
  useDeleteSkillShredMutation,
  useRetrySkillShredMutation,
  useSkillShredsQuery,
} from "./api";

const TARGET_TIMES: { value: number; label: string }[] = [
  { value: 30, label: "Spike saja (30 min)" },
  { value: 60, label: "Toy project lengkap (1 jam)" },
  { value: 180, label: "Setengah hari (3 jam)" },
];

const STATUS_LABELS: Record<SkillShredStatus, string> = {
  generating: "Crafting...",
  draft: "Draft",
  spike_done: "Spike done",
  building: "Building",
  completed: "Completed",
  failed: "Failed",
  archived: "Archived",
};

export function totalStepCount(blueprint: SkillShredderResult): number {
  return 2 + blueprint.milestones.length;
}

function StatusBadge({ status }: { status: SkillShredStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "completed"
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : status === "building"
            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
            : status === "spike_done"
              ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
              : status === "generating"
                ? "animate-pulse bg-primary/15 text-primary"
                : status === "failed"
                  ? "bg-destructive/15 text-destructive"
                  : status === "archived"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ShredInputDialog({
  open,
  onOpenChange,
  initialTopic,
  initialContext,
  noteId,
  noteTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopic?: string;
  initialContext?: string;
  noteId?: string;
  noteTitle?: string;
}) {
  const navigate = useNavigate();
  const createMutation = useCreateSkillShredMutation();

  const [topic, setTopic] = useState(initialTopic ?? "");
  const [currentContext, setCurrentContext] = useState(initialContext ?? "");
  const [targetTime, setTargetTime] = useState<string>("60");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTopic(initialTopic ?? "");
    setCurrentContext(initialContext ?? "");
    setError(null);
  }, [open, initialTopic, initialContext]);

  const pending = createMutation.isPending;

  const handleGenerate = () => {
    setError(null);
    const parsed = skillShredderInputSchema.safeParse({
      topic: topic.trim(),
      currentContext: currentContext.trim() || undefined,
      targetTimeMinutes: Number(targetTime),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    createMutation.mutate(
      {
        topic: parsed.data.topic,
        currentContext: parsed.data.currentContext,
        targetTimeMinutes: parsed.data.targetTimeMinutes,
        noteId,
      },
      {
        onSuccess: (shred) => {
          onOpenChange(false);
          toast.success("Shredding your topic — crafting a toy project...");
          navigate(`/skill-shredder/${shred.id}`);
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="size-4 text-primary" />
            Shred a skill
          </DialogTitle>
          <DialogDescription>
            Name a topic you want to learn. The AI turns it into one tiny toy
            project that teaches the fundamentals without the tutorial hell.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {noteTitle ? (
            <p className="text-xs text-muted-foreground">
              Creating practice from:{" "}
              <span className="font-medium text-foreground">{noteTitle}</span>
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="skill-topic">What do you want to learn?</Label>
            <Input
              id="skill-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. WebSockets in Cloudflare Workers"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-context">
              What do you already understand? (optional)
            </Label>
            <Textarea
              id="skill-context"
              value={currentContext}
              onChange={(event) => setCurrentContext(event.target.value)}
              placeholder="e.g. I'm comfortable with REST fetch requests but never used a persistent connection."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-time">Time available today</Label>
            <Select value={targetTime} onValueChange={setTargetTime}>
              <SelectTrigger id="skill-time" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TIMES.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={pending || topic.trim().length < 3}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {createMutation.isPending ? "Shredding..." : "Shred it"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShredCard({
  shred,
  onDelete,
}: {
  shred: SkillShredResponse;
  onDelete: (shred: SkillShredResponse) => void;
}) {
  const retryMutation = useRetrySkillShredMutation();
  const generating = shred.status === "generating";
  const failed = shred.status === "failed";
  const total = shred.blueprint ? totalStepCount(shred.blueprint) : 0;
  const done = shred.completedSteps.length;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4",
        failed && "border-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/skill-shredder/${shred.id}`}
          className="min-w-0 flex-1 space-y-1"
        >
          <h3 className="truncate font-medium hover:underline">{shred.topic}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {generating
              ? "AI is crafting your toy project... (usually 15–30 seconds)"
              : failed
                ? (shred.errorMessage ?? "Generation failed. Try again.")
                : shred.toyProjectTitle}
          </p>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete skill shred"
          onClick={() => onDelete(shred)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={shred.status} />
        {generating ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : failed ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={retryMutation.isPending}
            onClick={() =>
              retryMutation.mutate(shred.id, {
                onSuccess: () => toast.success("Retrying generation..."),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            {retryMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Retry
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {done}/{total} steps done
          </span>
        )}
      </div>

      {!generating && !failed ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SkillShredderPage() {
  const { data: shreds, isPending, isError, refetch } = useSkillShredsQuery();
  const deleteMutation = useDeleteSkillShredMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const sparkId = searchParams.get("spark") ?? undefined;
  const noteId = searchParams.get("note") ?? undefined;
  const { data: spark } = useSparkDetailQuery(sparkId ?? "");
  const { data: note } = useNoteDetailQuery(noteId ?? "");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (sparkId || noteId) {
      setDialogOpen(true);
    }
  }, [sparkId, noteId]);

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && (sparkId || noteId)) {
      setSearchParams({}, { replace: true });
    }
  };

  const openBlankDialog = () => {
    if (sparkId || noteId) {
      setSearchParams({}, { replace: true });
    }
    setDialogOpen(true);
  };

  const handleDelete = (shred: SkillShredResponse) => {
    deleteMutation.mutate(shred.id, {
      onSuccess: () => toast.success("Skill shred deleted"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Scissors className="size-6 text-primary" />
            Skill Shredder
          </h1>
          <p className="text-sm text-muted-foreground">
            Turn "I want to learn X" into one tiny toy project you can finish
            today.
          </p>
        </div>
        <Button onClick={openBlankDialog}>
          <Scissors className="size-4" />
          Shred a skill
        </Button>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Failed to load your skill shreds.
          </p>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && (shreds?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <GraduationCap className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No skills shredded yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Stop watching 10-hour tutorials. Name a topic and get a hands-on
              toy project that teaches the fundamentals.
            </p>
          </div>
          <Button onClick={openBlankDialog}>
            <Scissors className="size-4" />
            Shred your first skill
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && (shreds?.length ?? 0) > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {shreds?.map((shred) => (
            <ShredCard key={shred.id} shred={shred} onDelete={handleDelete} />
          ))}
        </div>
      ) : null}

      <ShredInputDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        initialTopic={
          note
            ? note.title.slice(0, 200)
            : spark
              ? sparkTitle(spark.content, 200)
              : undefined
        }
        initialContext={
          note
            ? noteToShredContext(note.content, 500)
            : spark
              ? spark.content.slice(0, 500)
              : undefined
        }
        noteId={noteId}
        noteTitle={note?.title}
      />
    </div>
  );
}

export { StatusBadge };
