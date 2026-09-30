import { cn } from "cn";

import type { TagResponse } from "@/shared/schemas/tag";

export function TagChip({
  tag,
  className,
}: {
  tag: TagResponse;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {tag.name}
    </span>
  );
}

export function formatBragLogDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
