import {
  AlertTriangle,
  Check,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Textarea } from "@/client/components/ui/textarea";
import {
  updateBragLogSchema,
  type BragLogResponse,
} from "@/shared/schemas/brag-log";

import {
  useRefineBragLogMutation,
  useUpdateBragLogMutation,
} from "./api";

type RefineFieldKey = "title" | "situation" | "task" | "action" | "result";

type RefineFields = Record<RefineFieldKey, string>;
type SectionSelection = Record<RefineFieldKey, boolean>;

const REFINE_SECTIONS: {
  key: RefineFieldKey;
  label: string;
  icon: typeof FileText;
  className: string;
  multiline: boolean;
}[] = [
  {
    key: "title",
    label: "Title",
    icon: FileText,
    className: "text-primary",
    multiline: false,
  },
  {
    key: "situation",
    label: "Situation",
    icon: Lightbulb,
    className: "text-amber-600 dark:text-amber-400",
    multiline: true,
  },
  {
    key: "task",
    label: "Task",
    icon: Target,
    className: "text-blue-600 dark:text-blue-400",
    multiline: true,
  },
  {
    key: "action",
    label: "Action",
    icon: Wrench,
    className: "text-violet-600 dark:text-violet-400",
    multiline: true,
  },
  {
    key: "result",
    label: "Result",
    icon: TrendingUp,
    className: "text-emerald-600 dark:text-emerald-400",
    multiline: true,
  },
];

type BragLogRefineDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bragLog: BragLogResponse;
};

export function BragLogRefineDialog({
  open,
  onOpenChange,
  bragLog,
}: BragLogRefineDialogProps) {
  const refineMutation = useRefineBragLogMutation();
  const updateMutation = useUpdateBragLogMutation();

  const [aiDraft, setAiDraft] = useState<RefineFields | null>(null);
  const [editedValues, setEditedValues] = useState<RefineFields>({
    title: bragLog.title,
    situation: bragLog.situation,
    task: bragLog.task,
    action: bragLog.action,
    result: bragLog.result,
  });
  const [selected, setSelected] = useState<SectionSelection>({
    title: true,
    situation: true,
    task: true,
    action: true,
    result: true,
  });
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const runRefinement = useCallback(() => {
    setAiError(null);
    setSaveError(null);
    refineMutation.mutate(bragLog.id, {
      onSuccess: (breakdown) => {
        const nextFields: RefineFields = {
          title: breakdown.title,
          situation: breakdown.situation,
          task: breakdown.task,
          action: breakdown.action,
          result: breakdown.result,
        };
        setAiDraft(nextFields);
        setEditedValues(nextFields);
        setSelected({
          title: true,
          situation: true,
          task: true,
          action: true,
          result: true,
        });
      },
      onError: (err) => {
        setAiError(err.message);
      },
    });
  }, [bragLog.id, refineMutation.mutate]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setAiDraft(null);
    setSaveError(null);
    runRefinement();
  }, [open, runRefinement]);

  const handleFieldChange = (key: RefineFieldKey, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setSelected((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const handleResetField = (key: RefineFieldKey) => {
    if (!aiDraft) {
      return;
    }
    setEditedValues((prev) => ({ ...prev, [key]: aiDraft[key] }));
    setSelected((prev) => ({ ...prev, [key]: true }));
  };

  const setAllSelected = (value: boolean) => {
    setSelected({
      title: value,
      situation: value,
      task: value,
      action: value,
      result: value,
    });
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleSave = () => {
    setSaveError(null);

    const payload = {
      title: (selected.title ? editedValues.title : bragLog.title).trim(),
      situation: (
        selected.situation ? editedValues.situation : bragLog.situation
      ).trim(),
      task: (selected.task ? editedValues.task : bragLog.task).trim(),
      action: (selected.action ? editedValues.action : bragLog.action).trim(),
      result: (selected.result ? editedValues.result : bragLog.result).trim(),
    };

    const parsed = updateBragLogSchema.safeParse(payload);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    updateMutation.mutate(
      { id: bragLog.id, input: parsed.data },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Brag log refined");
        },
        onError: (err) => {
          setSaveError(err.message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Refine brag log with AI
          </DialogTitle>
          <DialogDescription>
            Compare your current STAR sections against the AI-polished version.
            Choose which sections to apply or tweak the refined text before
            saving.
          </DialogDescription>
        </DialogHeader>

        {refineMutation.isPending ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Polishing your STAR breakdown...
              </p>
              <p className="text-xs text-muted-foreground">
                Sharpening clarity, active voice, and impact while preserving
                your facts.
              </p>
            </div>
          </div>
        ) : aiError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                Couldn&apos;t refine brag log
              </p>
              <p className="text-xs text-muted-foreground">{aiError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={runRefinement}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          </div>
        ) : aiDraft ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Applying AI refinement to{" "}
                <span className="font-medium text-foreground">
                  {selectedCount} of {REFINE_SECTIONS.length}
                </span>{" "}
                sections
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setAllSelected(true)}
                >
                  Select all AI
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setAllSelected(false)}
                >
                  Keep all original
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={runRefinement}
                  disabled={refineMutation.isPending}
                >
                  <RefreshCw className="size-3.5" />
                  Regenerate
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {REFINE_SECTIONS.map((section) => {
                const Icon = section.icon;
                const useAi = selected[section.key];
                const isModified =
                  editedValues[section.key] !== aiDraft[section.key];

                return (
                  <div
                    key={section.key}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`size-4 ${section.className}`} />
                        <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {section.label}
                        </h3>
                      </div>

                      <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSelected((prev) => ({
                              ...prev,
                              [section.key]: false,
                            }))
                          }
                          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            !useAi
                              ? "bg-background text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {!useAi ? <Check className="size-3" /> : null}
                          Keep original
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelected((prev) => ({
                              ...prev,
                              [section.key]: true,
                            }))
                          }
                          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            useAi
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {useAi ? <Check className="size-3" /> : null}
                          Use AI refined
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div
                        className={`rounded-md border p-3 transition-opacity ${
                          !useAi
                            ? "border-foreground/30 bg-muted/40"
                            : "bg-muted/20 opacity-75"
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Original
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                          {bragLog[section.key]}
                        </p>
                      </div>

                      <div
                        className={`rounded-md border p-3 transition-opacity ${
                          useAi
                            ? "border-primary/40 bg-primary/5"
                            : "bg-muted/10 opacity-60"
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-primary">
                            <Sparkles className="size-3" />
                            AI Refined (Editable)
                          </span>
                          {isModified ? (
                            <button
                              type="button"
                              onClick={() => handleResetField(section.key)}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              title="Reset to AI suggestion"
                            >
                              <RotateCcw className="size-3" />
                              Reset
                            </button>
                          ) : null}
                        </div>

                        {section.multiline ? (
                          <Textarea
                            aria-label={`Refined ${section.label}`}
                            value={editedValues[section.key]}
                            onChange={(e) =>
                              handleFieldChange(section.key, e.target.value)
                            }
                            rows={4}
                            maxLength={5000}
                            className="bg-background text-sm leading-relaxed"
                          />
                        ) : (
                          <Input
                            aria-label={`Refined ${section.label}`}
                            value={editedValues[section.key]}
                            onChange={(e) =>
                              handleFieldChange(section.key, e.target.value)
                            }
                            maxLength={200}
                            className="bg-background text-sm"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {saveError ? (
          <p className="text-sm text-destructive">{saveError}</p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              refineMutation.isPending ||
              updateMutation.isPending ||
              !aiDraft ||
              selectedCount === 0
            }
          >
            {updateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Apply {selectedCount > 0 ? `(${selectedCount})` : ""} &amp; save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

