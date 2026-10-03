import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  sourceKinds,
  type SourceInput,
  type SourceResponse,
} from "@/shared/schemas/source";

export type SourceDraft = {
  url: string;
  label: string;
  kind: string;
  locator: string;
};

const kindLabels: Record<string, string> = {
  video: "Video",
  course: "Course",
  book: "Book",
  article: "Article",
  link: "Link",
  other: "Other",
};

export function emptySourceDraft(): SourceDraft {
  return { url: "", label: "", kind: "", locator: "" };
}

export function sourceDraftsFromResponse(
  sources: SourceResponse[],
): SourceDraft[] {
  return sources.map((source) => ({
    url: source.url ?? "",
    label: source.label ?? "",
    kind: source.kind ?? "",
    locator: source.locator ?? "",
  }));
}

export function normalizeSourceDrafts(sources: SourceDraft[]): SourceInput[] {
  return sources
    .map((source) => ({
      url: source.url.trim(),
      label: source.label.trim(),
      kind: source.kind.trim(),
      locator: source.locator.trim(),
    }))
    .filter((source) => source.url.length > 0 || source.label.length > 0)
    .map((source) => ({
      ...(source.url ? { url: source.url } : {}),
      ...(source.label ? { label: source.label } : {}),
      ...(source.kind
        ? { kind: source.kind as (typeof sourceKinds)[number] }
        : {}),
      ...(source.locator ? { locator: source.locator } : {}),
    }));
}

type SourceEditorProps = {
  sources: SourceDraft[];
  onChange: (sources: SourceDraft[]) => void;
  label?: string;
  emptyHint?: string;
};

export function SourceEditor({
  sources,
  onChange,
  label = "Sources",
  emptyHint = "No sources yet. Add links, books, or courses related to this entry.",
}: SourceEditorProps) {
  const addSource = () => onChange([...sources, emptySourceDraft()]);
  const updateSource = (index: number, patch: Partial<SourceDraft>) =>
    onChange(
      sources.map((source, i) =>
        i === index ? { ...source, ...patch } : source,
      ),
    );
  const removeSource = (index: number) =>
    onChange(sources.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addSource}>
          <Plus className="size-3.5" />
          Add source
        </Button>
      </div>
      {sources.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="space-y-3">
          {sources.map((source, index) => (
            <div
              key={index}
              className="space-y-2 rounded-md border bg-card/50 p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={source.kind || "none"}
                  onValueChange={(value) =>
                    updateSource(index, {
                      kind: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger className="sm:w-36" aria-label="Source kind">
                    <SelectValue placeholder="Kind" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kind</SelectItem>
                    {sourceKinds.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {kindLabels[kind] ?? kind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={source.label}
                  onChange={(event) =>
                    updateSource(index, { label: event.target.value })
                  }
                  placeholder="Title or label (e.g. Clean Code)"
                  maxLength={200}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSource(index)}
                  aria-label="Remove source"
                  title="Remove source"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={source.url}
                  onChange={(event) =>
                    updateSource(index, { url: event.target.value })
                  }
                  placeholder="https://example.com (optional)"
                  maxLength={2048}
                  inputMode="url"
                  className="flex-1"
                />
                <Input
                  value={source.locator}
                  onChange={(event) =>
                    updateSource(index, { locator: event.target.value })
                  }
                  placeholder="Locator (p.120, Ch.3, 1:23:45)"
                  maxLength={200}
                  className="sm:w-56"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
