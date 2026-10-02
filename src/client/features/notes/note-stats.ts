const WORDS_PER_MINUTE = 200;

function toPlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(content: string): number {
  const plain = toPlainText(content);
  if (!plain) {
    return 0;
  }
  return plain.split(" ").length;
}

export function estimateReadingMinutes(content: string): number {
  return Math.max(1, Math.ceil(countWords(content) / WORDS_PER_MINUTE));
}
