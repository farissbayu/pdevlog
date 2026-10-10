import { cn } from "cn";

import type { ProjectItemKind } from "@/shared/schemas/project";

export const KIND_LABELS: Record<ProjectItemKind, string> = {
  feat: "Feature",
  fix: "Fix",
  perf: "Perf",
  refactor: "Refactor",
  spike: "Spike",
  docs: "Docs",
};

export const ITEM_KIND_OPTIONS: { value: ProjectItemKind; label: string }[] = [
  { value: "feat", label: "Feature" },
  { value: "fix", label: "Fix" },
  { value: "perf", label: "Perf" },
  { value: "refactor", label: "Refactor" },
  { value: "spike", label: "Spike" },
  { value: "docs", label: "Docs" },
];

const KIND_STYLES: Record<ProjectItemKind, string> = {
  feat: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  fix: "bg-red-500/10 text-red-600 dark:text-red-400",
  perf: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  refactor: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  spike: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  docs: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export function KindChip({
  kind,
  className,
}: {
  kind: ProjectItemKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        KIND_STYLES[kind],
        className,
      )}
    >
      {kind}
    </span>
  );
}
