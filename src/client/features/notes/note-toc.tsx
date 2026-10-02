import GithubSlugger from "github-slugger";
import { useEffect, useState } from "react";
import { cn } from "cn";

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

export function NoteToc({ headings }: { headings: NoteHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    headings[0]?.id ?? null,
  );

  useEffect(() => {
    if (headings.length === 0) {
      return;
    }

    setActiveId((current) =>
      current && headings.some((heading) => heading.id === current)
        ? current
        : headings[0].id,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label="On this page">
      <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1 border-l">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              style={{ paddingLeft: `${(heading.level - 1) * 0.75 + 0.75}rem` }}
              className={cn(
                "-ml-px block border-l py-0.5 text-sm transition-colors",
                activeId === heading.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
