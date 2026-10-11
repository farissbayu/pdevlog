import { useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Lock,
  Plus,
  Scissors,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type {
  EvidenceType,
  SkillMilestoneResponse,
} from "@/shared/schemas/skills";

import { useAttachEvidenceMutation, useUnlinkEvidenceMutation } from "../api";

function EvidenceIcon({ type }: { type: EvidenceType }) {
  switch (type) {
    case "brag_log":
      return <Trophy className="size-3.5 text-amber-500" />;
    case "note":
      return <BookOpen className="size-3.5 text-blue-500" />;
    case "skill_shred":
      return <Scissors className="size-3.5 text-emerald-500" />;
    case "project_item":
      return <ExternalLink className="size-3.5 text-violet-500" />;
    case "cv":
      return <FileText className="size-3.5 text-purple-500" />;
    default:
      return <Sparkles className="size-3.5" />;
  }
}

export function MilestoneCard({
  milestone,
}: {
  milestone: SkillMilestoneResponse;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("brag_log");
  const [evidenceId, setEvidenceId] = useState("");
  const [reflection, setReflection] = useState("");

  const unlinkMutation = useUnlinkEvidenceMutation();
  const attachMutation = useAttachEvidenceMutation();

  const isAchieved = milestone.status === "achieved" || milestone.evidences.length > 0;

  const handleAttachSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceId.trim()) return;

    attachMutation.mutate(
      {
        milestoneId: milestone.id,
        input: {
          evidenceType,
          evidenceId: evidenceId.trim(),
          reflection: reflection.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setEvidenceId("");
          setReflection("");
        },
      },
    );
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-all duration-200",
        isAchieved
          ? "border-primary/30 bg-card shadow-xs"
          : "border-border/60 bg-muted/20 opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-mono font-semibold",
              isAchieved
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            L{milestone.level}
          </span>
          <h4
            className={cn(
              "text-sm font-semibold leading-tight",
              isAchieved ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {milestone.title}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isAchieved ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Achieved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock className="size-3" />
              Locked
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
        {milestone.criteria}
      </p>

      {/* Linked Evidences List */}
      {milestone.evidences.length > 0 && (
        <div className="mt-3.5 space-y-2 border-t pt-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Verified Evidence ({milestone.evidences.length}):
          </p>
          <div className="flex flex-col gap-1.5">
            {milestone.evidences.map((ev) => (
              <div
                key={ev.id}
                className="group flex items-center justify-between rounded-md border bg-background/80 px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <EvidenceIcon type={ev.evidenceType} />
                  <Link
                    to={ev.url}
                    className="truncate font-medium text-foreground hover:underline"
                    title={ev.title}
                  >
                    {ev.title}
                  </Link>

                  {ev.autoDetected && (
                    <span
                      className="shrink-0 rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-mono text-primary"
                      title={ev.reflection ?? "Automatically matched by AI Growth Auditor"}
                    >
                      🤖 Auto-verified
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  title="Remove this evidence link"
                  disabled={unlinkMutation.isPending}
                  onClick={() => unlinkMutation.mutate(ev.id)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Attach Modal Trigger */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-3" />
          Attach Log / Note
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Evidence to Milestone</DialogTitle>
            <DialogDescription>
              Link a specific brag log or technical note to prove mastery of "
              {milestone.title}".
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAttachSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Evidence Source Type</Label>
              <Select
                value={evidenceType}
                onValueChange={(val) => setEvidenceType(val as EvidenceType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brag_log">🏆 STAR Brag Log</SelectItem>
                  <SelectItem value="note">📖 Technical Note / ADR</SelectItem>
                  <SelectItem value="skill_shred">
                    ✂️ Skill Shredder Toy Project
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Target Item ID or URL</Label>
              <Input
                placeholder="Paste ID or path (e.g. log ID or note ID)"
                value={evidenceId}
                onChange={(e) => setEvidenceId(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Reflection (Why this proves the milestone)
              </Label>
              <Input
                placeholder="e.g. Executed blue-green views with zero dropped queries"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={attachMutation.isPending || !evidenceId.trim()}
              >
                {attachMutation.isPending ? "Attaching..." : "Save Evidence"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
