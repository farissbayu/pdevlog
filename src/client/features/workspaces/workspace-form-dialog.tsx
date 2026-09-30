import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { cn } from "cn";

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
import { Textarea } from "@/client/components/ui/textarea";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type WorkspaceResponse,
  type WorkspaceTypeInput,
} from "@/shared/schemas/workspace";

import { useCreateWorkspaceMutation, useUpdateWorkspaceMutation } from "./api";

const typeOptions: { value: WorkspaceTypeInput; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "learning", label: "Learning" },
];

type WorkspaceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: WorkspaceResponse | null;
};

export function WorkspaceFormDialog({
  open,
  onOpenChange,
  workspace,
}: WorkspaceFormDialogProps) {
  const isEditing = Boolean(workspace);
  const createMutation = useCreateWorkspaceMutation();
  const updateMutation = useUpdateWorkspaceMutation();
  const mutation = isEditing ? updateMutation : createMutation;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<WorkspaceTypeInput>("work");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(workspace?.name ?? "");
    setDescription(workspace?.description ?? "");
    setType(workspace?.type ?? "work");
    setError(null);
  }, [open, workspace]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      type,
    };

    if (isEditing && workspace) {
      const parsed = updateWorkspaceSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      updateMutation.mutate(
        { id: workspace.id, input: parsed.data },
        {
          onSuccess: () => onOpenChange(false),
          onError: () => setError("Failed to update workspace"),
        },
      );
      return;
    }

    const parsed = createWorkspaceSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    createMutation.mutate(parsed.data, {
      onSuccess: () => onOpenChange(false),
      onError: () => setError("Failed to create workspace"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit workspace" : "New workspace"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details of this workspace."
              : "Group your brag logs and learning notes under a workspace."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Acme Platform"
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-description">Description</Label>
            <Textarea
              id="workspace-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this workspace about? (optional)"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
                    type === option.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
              {isEditing ? "Save changes" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
