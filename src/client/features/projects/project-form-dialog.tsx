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
  createProjectSchema,
  updateProjectSchema,
  type ProjectResponse,
} from "@/shared/schemas/project";

import { useCreateProjectMutation, useUpdateProjectMutation } from "./api";

type ProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  project?: ProjectResponse | null;
};

export function ProjectFormDialog({
  open,
  onOpenChange,
  workspaceId,
  project,
}: ProjectFormDialogProps) {
  const isEditing = Boolean(project);
  const createMutation = useCreateProjectMutation();
  const updateMutation = useUpdateProjectMutation();
  const mutation = isEditing ? updateMutation : createMutation;

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [status, setStatus] = useState<"active" | "maintenance" | "archived">(
    "active",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(project?.name ?? "");
    setTagline(project?.tagline ?? "");
    setDescription(project?.description ?? "");
    setRepoUrl(project?.repoUrl ?? "");
    setLiveUrl(project?.liveUrl ?? "");
    setStatus(project?.status ?? "active");
    setError(null);
  }, [open, project]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload = {
      name: name.trim(),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      repo_url: repoUrl.trim() || null,
      live_url: liveUrl.trim() || null,
      status,
    };

    if (isEditing && project) {
      const parsed = updateProjectSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      updateMutation.mutate(
        { id: project.id, input: parsed.data },
        {
          onSuccess: () => {
            onOpenChange(false);
            toast.success("Project updated");
          },
          onError: (mutationError) => setError(mutationError.message),
        },
      );
      return;
    }

    const parsed = createProjectSchema.safeParse({
      ...payload,
      workspace_id: workspaceId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    createMutation.mutate(parsed.data, {
      onSuccess: () => {
        onOpenChange(false);
        toast.success("Project created");
      },
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            Track a software project&rsquo;s backlog and shipped changelog.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. pdevlog"
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-tagline">Tagline</Label>
            <Input
              id="project-tagline"
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              placeholder="Short one-liner"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-repo">Repo URL</Label>
              <Input
                id="project-repo"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-live">Live URL</Label>
              <Input
                id="project-live"
                value={liveUrl}
                onChange={(event) => setLiveUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as typeof status)
                }
              >
                <SelectTrigger id="project-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

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
              {isEditing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
