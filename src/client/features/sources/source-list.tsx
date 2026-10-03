import {
  BookOpen,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  Video,
} from "lucide-react";

import type { SourceResponse } from "@/shared/schemas/source";

function SourceIcon({ kind }: { kind: SourceResponse["kind"] }) {
  const className = "size-3.5 shrink-0";
  switch (kind) {
    case "video":
      return <Video className={className} />;
    case "course":
      return <GraduationCap className={className} />;
    case "book":
      return <BookOpen className={className} />;
    case "article":
      return <FileText className={className} />;
    default:
      return <Link2 className={className} />;
  }
}

type SourceListProps = {
  sources: SourceResponse[];
  title?: string;
};

export function SourceList({ sources, title = "Sources" }: SourceListProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex flex-col gap-1">
        {sources.map((source) => {
          const label = source.label || source.url || "Source";
          const body = (
            <>
              <SourceIcon kind={source.kind} />
              <span className="truncate">{label}</span>
              {source.locator ? (
                <span className="shrink-0 text-muted-foreground">
                  · {source.locator}
                </span>
              ) : null}
              {source.url ? (
                <ExternalLink className="size-3 shrink-0" />
              ) : null}
            </>
          );
          return (
            <li key={source.id} className="min-w-0">
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  {body}
                </a>
              ) : (
                <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-muted-foreground">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
