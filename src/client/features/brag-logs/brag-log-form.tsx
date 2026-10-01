import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/client/components/ui/textarea";
import { useTagsQuery } from "@/client/features/tags/api";
import {
  createBragLogSchema,
  updateBragLogSchema,
  type BragLogResponse,
} from "@/shared/schemas/brag-log";

import { useCreateBragLogMutation, useUpdateBragLogMutation } from "./api";

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
};

export function BragLogFormDialog({
  open,
  onOpenChange,
  bragLog,
  workspaceId,
}: BragLogFormDialogProps) {
  const isEditing = Boolean(bragLog);
  const createMutation = useCreateBragLogMutation();
  const updateMutation = useUpdateBragLogMutation();
  const mutation = isEditing ? updateMutation : createMutation;

  const { data: tags } = useTagsQuery();

  const [title, setTitle] = useState("");
  const [situation, setSituation] = useState("");
  const [task, setTask] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(bragLog?.title ?? "");
    setSituation(bragLog?.situation ?? "");
    setTask(bragLog?.task ?? "");
    setAction(bragLog?.action ?? "");
    setResult(bragLog?.result ?? "");
    setTagIds(bragLog?.tags.map((tag) => tag.id) ?? []);
    setError(null);
  }, [open, bragLog]);

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
      ...(isEditing
        ? {}
        : { occurred_at: todayIso(), workspace_id: workspaceId ?? null }),
    };

    if (isEditing && bragLog) {
      const parsed = updateBragLogSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
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
          <DialogTitle>{isEditing ? "Edit brag log" : "New brag log"}</DialogTitle>
          <DialogDescription>
            Capture an achievement or bug fix using the STAR framework.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="brag-title">Title</Label>
            <Input
              id="brag-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Cut API p95 latency by 40%"
              maxLength={200}
              autoFocus
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
