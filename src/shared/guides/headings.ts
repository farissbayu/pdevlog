import GithubSlugger from "github-slugger";

export type NoteHeading = {
  id: string;
  text: string;
  level: number;
};

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .trim();
}

export function extractHeadings(content: string, maxLevel = 3): NoteHeading[] {
  const slugger = new GithubSlugger();
  const headings: NoteHeading[] = [];
  let inCodeBlock = false;

  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const level = match[1].length;
    const text = stripInlineMarkdown(match[2]);
    const id = slugger.slug(text);

    if (level <= maxLevel && text) {
      headings.push({ id, text, level });
    }
  }

  return headings;
}
