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
import type { ProjectItemKind } from "@/shared/schemas/project";
import { sparkTitle, type SparkResponse } from "@/shared/schemas/spark";

import { useAllProjectsQuery, useCreateProjectItemMutation } from "./api";
import { ITEM_KIND_OPTIONS } from "./kind-chip";

type SparkToBacklogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spark: SparkResponse | null;
};

export function SparkToBacklogDialog({
  open,
  onOpenChange,
  spark,
}: SparkToBacklogDialogProps) {
  const { data: projectsData } = useAllProjectsQuery();
  const projects = projectsData?.projects ?? [];
  const mutation = useCreateProjectItemMutation();

  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState<ProjectItemKind>("feat");
  const [targetVersion, setTargetVersion] = useState("Next");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setProjectId(projects[0]?.id ?? "");
    setKind("feat");
    setTargetVersion("Next");
    setError(null);
  }, [open, projects]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!spark) {
      return;
    }
    if (!projectId) {
      setError("Create a project first, then promote this spark.");
      return;
    }

    mutation.mutate(
      {
        projectId,
        input: {
          title: sparkTitle(spark.content),
          description: spark.content || null,
          kind,
          target_version: targetVersion.trim() || "Next",
          spark_id: spark.id,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Spark added to backlog");
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to project backlog</DialogTitle>
          <DialogDescription>
            {spark ? sparkTitle(spark.content) : ""}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="spark-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="spark-project" className="w-full">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="spark-kind">Kind</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as ProjectItemKind)}
              >
                <SelectTrigger id="spark-kind" className="w-full">
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
              <Label htmlFor="spark-version">Target version</Label>
              <Input
                id="spark-version"
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
              Add to backlog
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
