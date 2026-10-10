import { sourceKinds } from "@/shared/schemas/source";

import type { SourceDraft } from "./types";

type SourceKind = (typeof sourceKinds)[number];

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)\s]+\)/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const RAW_URL_PATTERN = /https?:\/\/[^\s<>()"']+/g;

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];
const COURSE_HOSTS = ["coursera.org", "udemy.com", "pluralsight.com"];

function hostMatches(host: string, candidates: string[]): boolean {
  return candidates.some(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`),
  );
}

export function cleanUrl(rawUrl: string): string {
  let url = rawUrl.trim().replace(/[.,;:!?]+$/, "");
  while (
    url.endsWith(")") &&
    (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)
  ) {
    url = url.slice(0, -1);
  }
  return url;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function guessKindFromUrl(url: string): SourceKind {
  const host = hostnameOf(url);
  if (hostMatches(host, VIDEO_HOSTS)) {
    return "video";
  }
  if (hostMatches(host, COURSE_HOSTS)) {
    return "course";
  }
  return "link";
}

export function extractSourcesFromText(
  text: string,
  existingUrls: string[] = [],
): SourceDraft[] {
  if (!text) {
    return [];
  }

  const skip = new Set(existingUrls.map((url) => cleanUrl(url).toLowerCase()));
  const seen = new Set<string>();
  const results: SourceDraft[] = [];

  const push = (rawUrl: string, label: string, preferArticle: boolean) => {
    const url = cleanUrl(rawUrl);
    if (!url) {
      return;
    }
    const key = url.toLowerCase();
    if (skip.has(key) || seen.has(key)) {
      return;
    }
    seen.add(key);
    const guessed = guessKindFromUrl(url);
    results.push({
      url,
      label: label.trim() || hostnameOf(url),
      kind: preferArticle && guessed === "link" ? "article" : guessed,
      locator: "",
    });
  };

  const withoutImages = text.replace(MARKDOWN_IMAGE_PATTERN, " ");
  const withoutLinks = withoutImages.replace(
    MARKDOWN_LINK_PATTERN,
    (_match, label: string, url: string) => {
      push(url, label, true);
      return " ";
    },
  );
  for (const match of withoutLinks.matchAll(RAW_URL_PATTERN)) {
    push(match[0], "", false);
  }

  return results;
}
