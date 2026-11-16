export type ExportFormat = "star" | "bullets";

export const BULLET_MAX_LENGTH = 200;

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function lastSentenceEnd(text: string, max: number): number {
  let end = -1;
  for (const match of text.matchAll(/[.!?](?=\s)/g)) {
    const index = match.index ?? 0;
    if (index + 1 > max) {
      break;
    }
    end = index + 1;
  }
  return end;
}

/** Cut at the last sentence end before `max`; fall back to a word boundary + "…". */
export function trimToSentence(text: string, max: number): string {
  const collapsed = collapseWhitespace(text);
  if (collapsed.length <= max) {
    return collapsed;
  }

  const sentenceEnd = lastSentenceEnd(collapsed, max);
  if (sentenceEnd > 0) {
    return collapsed.slice(0, sentenceEnd);
  }

  const space = collapsed.lastIndexOf(" ", max);
  if (space > 0) {
    return `${collapsed.slice(0, space)}…`;
  }
  return `${collapsed.slice(0, max)}…`;
}

/** "- **Title** — <result ringkas> (2026-03-12 · Database, Backend)" */
export function bulletLine(
  log: { title: string; result: string; action: string; occurredAt: string },
  tagNames: string[],
): string {
  const summary = trimToSentence(
    collapseWhitespace(log.result || log.action),
    BULLET_MAX_LENGTH,
  );
  const meta =
    tagNames.length > 0
      ? `${log.occurredAt} · ${tagNames.join(", ")}`
      : log.occurredAt;

  return `- **${log.title}** — ${summary} (${meta})`;
}
