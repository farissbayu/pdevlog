import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
import {
  updateProjectItemSchema,
  type ProjectItemResponse,
} from "@/shared/schemas/project";

import { useUpdateProjectItemMutation } from "./api";
import { ITEM_KIND_OPTIONS } from "./kind-chip";

type ProjectItemFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  item: ProjectItemResponse | null;
};

export function ProjectItemFormDialog({
  open,
  onOpenChange,
  projectId,
  item,
}: ProjectItemFormDialogProps) {
  const mutation = useUpdateProjectItemMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ProjectItemResponse["kind"]>("feat");
  const [status, setStatus] = useState<ProjectItemResponse["status"]>("backlog");
  const [targetVersion, setTargetVersion] = useState("Next");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) {
      return;
    }
    setTitle(item.title);
    setDescription(item.description ?? "");
    setKind(item.kind);
    setStatus(item.status);
    setTargetVersion(item.targetVersion);
    setError(null);
  }, [open, item]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) {
      return;
    }
    setError(null);

    const parsed = updateProjectItemSchema.safeParse({
      title: title.trim(),
      description: description.trim() || null,
      kind,
      status,
      target_version: targetVersion.trim() || "Next",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    mutation.mutate(
      { projectId, itemId: item.id, input: parsed.data },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Item updated");
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          <DialogDescription>
            Update the plan for this backlog item.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="item-kind">Kind</Label>
              <Select
                value={kind}
                onValueChange={(value) =>
                  setKind(value as ProjectItemResponse["kind"])
                }
              >
                <SelectTrigger id="item-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ProjectItemResponse["status"])
                }
              >
                <SelectTrigger id="item-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-version">Target version</Label>
              <Input
                id="item-version"
                value={targetVersion}
                onChange={(event) => setTargetVersion(event.target.value)}
                maxLength={100}
              />
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
