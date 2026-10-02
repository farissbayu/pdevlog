import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

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
import { MultiSelect } from "@/client/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";
import { useTagsQuery } from "@/client/features/tags/api";
import { useWorkspacesQuery } from "@/client/features/workspaces/api";
import {
  createBragLogSchema,
  updateBragLogSchema,
  type BragLogResponse,
} from "@/shared/schemas/brag-log";
import type { SparkResponse } from "@/shared/schemas/spark";

import {
  useCreateBragLogMutation,
  useGenerateStarBreakdownMutation,
  useUpdateBragLogMutation,
} from "./api";

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type BragLogFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bragLog?: BragLogResponse | null;
  workspaceId?: string;
  spark?: SparkResponse | null;
};

export function BragLogFormDialog({
  open,
  onOpenChange,
  bragLog,
  workspaceId,
  spark,
}: BragLogFormDialogProps) {
  const isEditing = Boolean(bragLog);
  const createMutation = useCreateBragLogMutation();
  const updateMutation = useUpdateBragLogMutation();
  const mutation = isEditing ? updateMutation : createMutation;

  const { data: tags } = useTagsQuery();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const generateMutation = useGenerateStarBreakdownMutation();

  const [sourceContent, setSourceContent] = useState("");
  const [title, setTitle] = useState("");
  const [situation, setSituation] = useState("");
  const [task, setTask] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSourceContent(bragLog ? "" : (spark?.content ?? ""));
    setTitle(bragLog?.title ?? "");
    setSituation(bragLog?.situation ?? "");
    setTask(bragLog?.task ?? "");
    setAction(bragLog?.action ?? "");
    setResult(bragLog?.result ?? "");
    setTagIds(
      bragLog?.tags.map((tag) => tag.id) ??
        spark?.tags.map((tag) => tag.id) ??
        [],
    );
    setSelectedWorkspaceId(bragLog?.workspaceId ?? workspaceId ?? "");
    setShowDetails(Boolean(bragLog));
    setError(null);
    setAiError(null);
  }, [open, bragLog, spark, workspaceId]);

  const handleGenerate = () => {
    setAiError(null);
    generateMutation.mutate(
      { content: sourceContent.trim() },
      {
        onSuccess: (breakdown) => {
          setTitle(breakdown.title);
          setSituation(breakdown.situation);
          setTask(breakdown.task);
          setAction(breakdown.action);
          setResult(breakdown.result);
          if (breakdown.tag_ids.length > 0) {
            setTagIds((current) => [
              ...new Set([...current, ...breakdown.tag_ids]),
            ]);
          }
          setShowDetails(true);
        },
        onError: (mutationError) => setAiError(mutationError.message),
      },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload = {
      title: title.trim(),
      situation: situation.trim(),
      task: task.trim(),
      action: action.trim(),
      result: result.trim(),
      tag_ids: tagIds,
      workspace_id: selectedWorkspaceId || null,
      ...(isEditing
        ? {}
        : {
            occurred_at: todayIso(),
            ...(spark ? { spark_id: spark.id } : {}),
          }),
    };

    if (isEditing && bragLog) {
      const parsed = updateBragLogSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        setShowDetails(true);
        return;
      }
      updateMutation.mutate(
        { id: bragLog.id, input: parsed.data },
        {
          onSuccess: () => onOpenChange(false),
          onError: (mutationError) => setError(mutationError.message),
        },
      );
      return;
    }

    const parsed = createBragLogSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    createMutation.mutate(parsed.data, {
      onSuccess: () => onOpenChange(false),
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  const starFields: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }[] = [
    {
      id: "brag-situation",
      label: "Situation",
      value: situation,
      onChange: setSituation,
      placeholder: "What was the context or background?",
    },
    {
      id: "brag-task",
      label: "Task",
      value: task,
      onChange: setTask,
      placeholder: "What was the goal or challenge?",
    },
    {
      id: "brag-action",
      label: "Action",
      value: action,
      onChange: setAction,
      placeholder: "What did you do to address it?",
    },
    {
      id: "brag-result",
      label: "Result",
      value: result,
      onChange: setResult,
      placeholder: "What was the outcome or impact?",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Edit brag log"
              : spark
                ? "Turn spark into a brag log"
                : "New brag log"}
          </DialogTitle>
          <DialogDescription>
            {spark
              ? "Use your spark as a starting point, then generate or fill the STAR fields."
              : "Capture an achievement or bug fix using the STAR framework."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <Label htmlFor="brag-source">Quick capture</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste rough notes about what you did and let AI draft the STAR
              fields. Review them before saving.
            </p>
            <Textarea
              id="brag-source"
              value={sourceContent}
              onChange={(event) => setSourceContent(event.target.value)}
              placeholder="e.g. Reworked the checkout retry logic after intermittent payment failures cut support tickets and recovered failed orders..."
              rows={4}
              maxLength={5000}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {sourceContent.trim().length}/5000
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleGenerate}
                disabled={
                  generateMutation.isPending ||
                  sourceContent.trim().length < 20
                }
              >
                {generateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {generateMutation.isPending ? "Generating..." : "Generate with AI"}
              </Button>
            </div>
            {aiError ? (
              <p className="text-sm text-destructive">{aiError}</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails((value) => !value)}
            >
              {showDetails ? "Hide fields" : "Fill fields manually"}
            </Button>
          </div>

          {showDetails ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="brag-title">Title</Label>
                <Input
                  id="brag-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Cut API p95 latency by 40%"
                  maxLength={200}
                />
              </div>

              {starFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Textarea
                    id={field.id}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    maxLength={5000}
                  />
                </div>
              ))}
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="brag-workspace">Workspace</Label>
            <Select
              value={selectedWorkspaceId || "none"}
              onValueChange={(value) =>
                setSelectedWorkspaceId(value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="brag-workspace" className="w-full">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No workspace (standalone)</SelectItem>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign this log to a workspace for context, or keep it standalone.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brag-tags">Tags</Label>
            {tags && tags.length > 0 ? (
              <MultiSelect
                id="brag-tags"
                aria-label="Tags"
                options={tags.map((tag) => ({
                  value: tag.id,
                  label: tag.name,
                }))}
                value={tagIds}
                onChange={setTagIds}
                placeholder="Select tags"
                searchPlaceholder="Search tags..."
                emptyMessage="No tag found."
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No tags yet. Create tags to label this log.
              </p>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isEditing ? "Save changes" : "Create log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
