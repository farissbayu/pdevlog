import { BadgeCheck, FlaskConical, Loader2, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/client/components/ui/button";
import { useCreateNoteMutation } from "@/client/features/notes/api";
import type {
  CaseStudyBrief,
  SkillGrowthAreaItem,
} from "@/shared/schemas/profile";

import { useGenerateCaseStudyMutation } from "../api";

function briefToMarkdown(
  growthArea: SkillGrowthAreaItem,
  brief: CaseStudyBrief,
): string {
  return [
    `## Blind Spot: ${growthArea.area}`,
    growthArea.gap,
    "",
    "## Why It Matters",
    growthArea.recommendation,
    "",
    "## Principle",
    brief.principle,
    "",
    "## Case Study",
    brief.caseStudy,
    "",
    "## Reasoning Steps",
    ...brief.reasoningSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Deliverable",
    brief.deliverable,
    "",
    "## Definition of Done",
    ...brief.definitionOfDone.map((item) => `- [ ] ${item}`),
    "",
    `_Estimated effort: ~${brief.estimatedHours}h_`,
  ].join("\n");
}

type CaseStudyPanelProps = {
  growthArea: SkillGrowthAreaItem;
};

export function CaseStudyPanel({ growthArea }: CaseStudyPanelProps) {
  const generate = useGenerateCaseStudyMutation();
  const createNote = useCreateNoteMutation();
  const [brief, setBrief] = useState<CaseStudyBrief | null>(null);
  const [saved, setSaved] = useState(false);

  const handleGenerate = () => {
    generate.mutate(growthArea.id, {
      onSuccess: (data) => {
        setBrief(data.brief);
        setSaved(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleSave = () => {
    if (!brief) {
      return;
    }
    createNote.mutate(
      {
        title: brief.title,
        content: briefToMarkdown(growthArea, brief),
      },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success("Saved to Notes (Unassigned)");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (!brief) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        disabled={generate.isPending}
        onClick={handleGenerate}
      >
        {generate.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FlaskConical className="size-3.5" />
        )}
        {generate.isPending ? "Generating Case Study..." : "Generate Case Study"}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
        <FlaskConical className="size-3.5" />
        First-Principles Case Study
      </div>
      <p className="text-xs font-medium text-foreground">{brief.title}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Principle:</strong> {brief.principle}
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Case Study:</strong>{" "}
        {brief.caseStudy}
      </p>
      {brief.reasoningSteps.length > 0 && (
        <div className="text-[11px] text-muted-foreground space-y-1">
          <strong className="text-foreground">Reasoning Steps:</strong>
          <ol className="space-y-0.5 pl-4 list-decimal">
            {brief.reasoningSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Deliverable:</strong>{" "}
        {brief.deliverable}
      </p>
      {brief.definitionOfDone.length > 0 && (
        <div className="text-[11px] text-muted-foreground space-y-1">
          <strong className="text-foreground">Definition of Done:</strong>
          <ul className="space-y-0.5 pl-4 list-disc">
            {brief.definitionOfDone.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground font-mono">
        ~{brief.estimatedHours}h estimated
      </p>

      <div className="flex items-center gap-2 pt-1">
        {saved ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="size-3.5" />
            Saved to Notes
          </div>
        ) : (
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            disabled={createNote.isPending}
            onClick={handleSave}
          >
            {createNote.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save as note
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={generate.isPending}
          onClick={handleGenerate}
        >
          {generate.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Regenerate
        </Button>
      </div>
    </div>
  );
}
