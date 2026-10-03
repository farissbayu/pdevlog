import { AlertTriangle, ArrowLeft, Loader2, Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { MarkdownRenderer } from "@/client/components/markdown-renderer";
import { Button } from "@/client/components/ui/button";
import { WorkspaceTypeBadge } from "@/client/features/workspaces/workspace-type-badge";

import { useNoteDetailQuery } from "./api";
import { formatNoteDate } from "./note-list";

export function NotePrintPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useNoteDetailQuery(id);
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (!data) {
      return;
    }

    let active = true;

    const triggerPrint = async () => {
      try {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((image) =>
            image.complete
              ? Promise.resolve()
              : image.decode().catch(() => undefined),
          ),
        );
      } catch {
        // Print even if fonts or images fail to settle.
      }

      if (active && !hasPrinted.current) {
        hasPrinted.current = true;
        window.print();
      }
    };

    void triggerPrint();

    return () => {
      active = false;
    };
  }, [data]);

  useEffect(() => {
    const handleAfterPrint = () => {
      navigate(-1);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="note-print-page flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Note not found</h1>
          <p className="text-sm text-muted-foreground">
            This note may have been deleted or you do not have access to it.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
          <Button asChild>
            <Link to="/notes">Back to notes</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="note-print-page min-h-svh">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/notes/${data.id}`}>
            <ArrowLeft className="size-4" />
            Back to note
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / Save as PDF
        </Button>
      </div>

      <article className="note-print-sheet mx-auto max-w-3xl px-6 py-10">
        <header className="note-print-header border-b pb-5">
          <h1 className="text-3xl font-semibold leading-tight">
            {data.title}
          </h1>
          <div className="note-print-meta mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span>Updated {formatNoteDate(data.updatedAt)}</span>
            {data.workspace ? (
              <span className="inline-flex items-center gap-1.5">
                <WorkspaceTypeBadge type={data.workspace.type} />
                {data.workspace.name}
              </span>
            ) : null}
            {data.tags.length > 0 ? (
              <span>Tags: {data.tags.map((tag) => tag.name).join(", ")}</span>
            ) : null}
          </div>
        </header>

        {data.sources.length > 0 ? (
          <section className="note-print-source mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sources
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {data.sources.map((source) => (
                <li key={source.id} className="break-words">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary underline underline-offset-2"
                    >
                      {source.label || source.url}
                    </a>
                  ) : (
                    <span>{source.label ?? "Source"}</span>
                  )}
                  {source.locator ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {source.locator}
                    </span>
                  ) : null}
                  {source.url && source.label ? (
                    <span className="block break-all text-xs text-muted-foreground">
                      {source.url}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="note-print-content mt-8">
          <MarkdownRenderer content={data.content} />
        </div>

        <footer className="note-print-footer mt-10 border-t pt-4 text-xs text-muted-foreground">
          Exported from Personal Dev Log on{" "}
          {new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </footer>
      </article>
    </div>
  );
}
