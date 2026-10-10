import {
  ArrowLeft,
  Ban,
  Brain,
  Check,
  ClipboardCopy,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
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
import {
  BragLogFormDialog,
  type BragLogPrefill,
} from "@/client/features/brag-logs/brag-log-form";
import { useCreateTagMutation, useTagsQuery } from "@/client/features/tags/api";
import {
  CHALLENGE_STEP_KEY,
  SPIKE_STEP_KEY,
  milestoneStepKey,
  type SkillShredResponse,
} from "@/shared/schemas/skill-shredder";

import {
  useDeleteSkillShredMutation,
  useExportSkillNoteMutation,
  useSkillShredQuery,
  useUpdateSkillProgressMutation,
} from "./api";
import { StatusBadge, totalStepCount } from "./skill-shredder-page";

const HARD_WIN_TAG = "Hard Win - Pure Logic";

function CountdownTimer({ minutes }: { minutes: number }) {
  const total = Math.max(1, minutes) * 60;
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRunning(false);
    setRemaining(total);
  }, [total]);

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const finished = remaining === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-lg tabular-nums",
          finished &&
            "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
        )}
      >
        <Timer className="size-4 text-muted-foreground" />
        {finished ? "Time's up" : `${mm}:${ss}`}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRunning((value) => !value)}
        disabled={finished}
      >
        {running ? <Pause className="size-4" /> : <Play className="size-4" />}
        {running ? "Pause" : "Start"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setRunning(false);
          setRemaining(total);
        }}
      >
        <RotateCcw className="size-4" />
        Reset
      </Button>
    </div>
  );
}

function TaskCheck({
  done,
  onToggle,
  title,
  description,
  footnote,
}: {
  done: boolean;
  onToggle: () => void;
  title: string;
  description: string;
  footnote?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent/50"
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input",
        )}
      >
        {done ? <Check className="size-3.5" /> : null}
      </span>
      <span className="space-y-1">
        <span
          className={cn(
            "block text-sm font-medium",
            done && "text-muted-foreground line-through",
          )}
        >
          {title}
        </span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
        {footnote ? (
          <span className="block text-xs text-muted-foreground italic">
            {footnote}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-4 rounded-lg border bg-card p-5", className)}
    >
      {children}
    </section>
  );
}

function BlueprintView({ shred }: { shred: SkillShredResponse }) {
  const { blueprint, completedSteps } = shred;
  const progressMutation = useUpdateSkillProgressMutation();
  const exportMutation = useExportSkillNoteMutation();
  const { data: tags } = useTagsQuery();
  const createTag = useCreateTagMutation();
  const navigate = useNavigate();
  const [bragOpen, setBragOpen] = useState(false);
  const [prefill, setPrefill] = useState<BragLogPrefill | null>(null);

  const completed = new Set(completedSteps);

  const toggleStep = (key: string) => {
    const next = completed.has(key)
      ? completedSteps.filter((item) => item !== key)
      : [...completedSteps, key];
    progressMutation.mutate(
      { id: shred.id, input: { completedSteps: next } },
      { onError: (error) => toast.error(error.message) },
    );
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(blueprint.spike0.scratchSnippet);
      toast.success("Scratch code copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleExport = () => {
    exportMutation.mutate(shred.id, {
      onSuccess: (data) => {
        toast.success("Exported to a TIL note");
        navigate(`/notes/${data.noteId}`);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const openBragForm = async () => {
    let tagIds: string[] = [];
    const existing = tags?.find((tag) => tag.name === HARD_WIN_TAG);
    if (existing) {
      tagIds = [existing.id];
    } else {
      try {
        const created = await createTag.mutateAsync({ name: HARD_WIN_TAG });
        tagIds = [created.id];
      } catch {
        tagIds = [];
      }
    }

    const action = [
      `Spike: ${blueprint.spike0.objective}`,
      ...blueprint.milestones.map(
        (step) => `Step ${step.stepNumber}: ${step.title}`,
      ),
    ].join(" ");

    setPrefill({
      title: blueprint.toyProjectTitle,
      situation: `Learning ${blueprint.topicTitle}. ${blueprint.toyProjectPitch}`,
      task: `Build a tiny toy project: ${blueprint.toyProjectTitle}. ${blueprint.spike0.objective}`,
      action,
      result: `Built the toy project end to end and solved the deliberate practice challenge without AI: ${blueprint.practiceChallenge.challenge}`,
      tagIds,
    });
    setBragOpen(true);
  };

  const spikeDone = completed.has(SPIKE_STEP_KEY);
  const challengeDone = completed.has(CHALLENGE_STEP_KEY);
  const doneCount = completedSteps.length;
  const totalCount = totalStepCount(blueprint);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
        <p className="mb-1 text-xs font-semibold tracking-wide text-primary uppercase">
          The "Todo App" for {blueprint.topicTitle}
        </p>
        <h2 className="text-lg font-semibold">{blueprint.toyProjectTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed">
          {blueprint.toyProjectPitch}
        </p>
      </div>

      <SectionCard>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-5 text-muted-foreground" />
          Fundamental pillars
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {blueprint.fundamentalPillars.map((pillar) => (
            <div key={pillar.name} className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">{pillar.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pillar.explanation}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                SPIKE 0
              </span>
              {blueprint.spike0.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {blueprint.spike0.objective}
            </p>
          </div>
        </div>

        <div className="relative rounded-md border bg-muted/40">
          <pre className="overflow-x-auto p-3 pr-12 text-xs leading-relaxed">
            <code>{blueprint.spike0.scratchSnippet}</code>
          </pre>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            aria-label="Copy scratch code"
            onClick={copySnippet}
          >
            <ClipboardCopy className="size-4" />
          </Button>
        </div>

        <p className="text-sm">
          <span className="font-medium">Success: </span>
          {blueprint.spike0.successCriteria}
        </p>

        <CountdownTimer minutes={blueprint.spike0.estimatedMinutes} />

        <TaskCheck
          done={spikeDone}
          onToggle={() => toggleStep(SPIKE_STEP_KEY)}
          title="Spike 0: first contact"
          description="I ran the scratch snippet and saw the success criterion."
        />
      </SectionCard>

      <SectionCard>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="size-5 text-muted-foreground" />
          Milestones
        </h2>
        <div className="space-y-2">
          {blueprint.milestones.map((step) => (
            <TaskCheck
              key={step.stepNumber}
              done={completed.has(milestoneStepKey(step.stepNumber))}
              onToggle={() => toggleStep(milestoneStepKey(step.stepNumber))}
              title={`Step ${step.stepNumber} · ${step.title} (~${step.estimatedMinutes} min)`}
              description={step.actionDescription}
              footnote={`Verify: ${step.verificationGuide}`}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard className="border-amber-500/40 bg-amber-500/5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Ban className="size-5 text-amber-600 dark:text-amber-400" />
          Ignore list
        </h2>
        <p className="text-sm text-muted-foreground">
          Forbidden today. Building these is how you end up in tutorial hell.
        </p>
        <ul className="space-y-1.5">
          {blueprint.ignoreList.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <Ban className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              {item}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard className="border-violet-500/40 bg-violet-500/5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Brain className="size-5 text-violet-600 dark:text-violet-400" />
          Deliberate practice challenge
        </h2>
        <p className="text-sm">{blueprint.practiceChallenge.challenge}</p>
        <p className="text-xs text-muted-foreground italic">
          Hint: {blueprint.practiceChallenge.hint}
        </p>
        <TaskCheck
          done={challengeDone}
          onToggle={() => toggleStep(CHALLENGE_STEP_KEY)}
          title="Solved it without asking AI"
          description="I modified the code myself and understood why it works."
        />
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {doneCount}/{totalCount} steps done
        </span>
        <div className="flex flex-wrap gap-2">
          {shred.noteId ? (
            <Button asChild variant="outline">
              <Link to={`/notes/${shred.noteId}`}>
                <FileText className="size-4" />
                View TIL note
              </Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            {shred.noteId ? "Export again" : "Export to Note (TIL)"}
          </Button>
          <Button onClick={openBragForm} disabled={createTag.isPending}>
            {createTag.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trophy className="size-4" />
            )}
            Log as Brag Win
          </Button>
        </div>
      </div>

      <BragLogFormDialog
        open={bragOpen}
        onOpenChange={setBragOpen}
        prefill={prefill}
      />
    </div>
  );
}

export function SkillShredderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: shred, isPending, isError, refetch } = useSkillShredQuery(id);
  const deleteMutation = useDeleteSkillShredMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success("Skill shred deleted");
        navigate("/skill-shredder");
      },
    });
  };

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !shred) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <p className="text-sm text-muted-foreground">
          This skill shred could not be loaded.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button asChild variant="ghost">
            <Link to="/skill-shredder">Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          to="/skill-shredder"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All skill shreds
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Scissors className="size-6 text-primary" />
              {shred.topic}
            </h1>
            <StatusBadge status={shred.status} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      <BlueprintView shred={shred} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete skill shred</DialogTitle>
            <DialogDescription>
              This will permanently delete "{shred.topic}" and its progress.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
