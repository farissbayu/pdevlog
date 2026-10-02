import { Boxes, Briefcase, GraduationCap } from "lucide-react";
import { cn } from "cn";

import type { WorkspaceTypeInput } from "@/shared/schemas/workspace";

const typeConfig: Record<
  WorkspaceTypeInput,
  { label: string; icon: typeof Briefcase; className: string }
> = {
  work: {
    label: "Work",
    icon: Briefcase,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  learning: {
    label: "Learning",
    icon: GraduationCap,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  general: {
    label: "General",
    icon: Boxes,
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
};

export function WorkspaceTypeBadge({
  type,
  className,
}: {
  type: WorkspaceTypeInput;
  className?: string;
}) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        config.className,
        className,
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
