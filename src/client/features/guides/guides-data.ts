import {
  countWords,
  estimateReadingMinutes,
} from "@/client/features/notes/note-stats";
import {
  extractHeadings,
  type NoteHeading,
} from "@/client/features/notes/note-toc";

export type GuideEntry = {
  slug: string;
  title: string;
  description: string;
  category: string;
  order: number;
  content: string;
  headings: NoteHeading[];
  words: number;
  readingMinutes: number;
};

export type GuideCategoryGroup = {
  category: string;
  guides: GuideEntry[];
};

const rawGuideModules = import.meta.glob<string>("/docs/guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

function parseFrontmatter(raw: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) {
    return { attributes: {}, body: normalized.trim() };
  }

  const attributes: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const key = line.slice(0, colonIndex).trim();
    const value = line
      .slice(colonIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) {
      attributes[key] = value;
    }
  }

  return {
    attributes,
    body: match[2].trim(),
  };
}

function deriveSlug(filePath: string): string {
  const filename = filePath.split("/").pop() ?? filePath;
  return filename
    .replace(/\.md$/i, "")
    .replace(/^\d+-/, "")
    .toLowerCase();
}

function buildGuides(): GuideEntry[] {
  const entries: GuideEntry[] = [];

  for (const [filePath, rawContent] of Object.entries(rawGuideModules)) {
    const slug = deriveSlug(filePath);
    const { attributes, body } = parseFrontmatter(rawContent);
    const order = Number.parseInt(attributes.order ?? "99", 10);

    entries.push({
      slug,
      title: attributes.title ?? slug,
      description: attributes.description ?? "",
      category: attributes.category ?? "General",
      order: Number.isNaN(order) ? 99 : order,
      content: body,
      headings: extractHeadings(body),
      words: countWords(body),
      readingMinutes: estimateReadingMinutes(body),
    });
  }

  return entries.sort((a, b) => a.order - b.order);
}

export const GUIDES: GuideEntry[] = buildGuides();

export const GUIDE_CATEGORIES: GuideCategoryGroup[] = (() => {
  const groups = new Map<string, GuideEntry[]>();
  for (const guide of GUIDES) {
    const existing = groups.get(guide.category) ?? [];
    existing.push(guide);
    groups.set(guide.category, existing);
  }
  return Array.from(groups.entries()).map(([category, guides]) => ({
    category,
    guides,
  }));
})();

export function getGuideBySlug(slug: string): GuideEntry | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

