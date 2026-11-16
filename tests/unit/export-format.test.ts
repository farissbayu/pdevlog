import { describe, expect, it } from "vitest";

import {
  bulletLine,
  collapseWhitespace,
  trimToSentence,
} from "@/shared/format/bullets";

describe("collapseWhitespace", () => {
  it("collapses runs of whitespace and trims", () => {
    expect(collapseWhitespace("  Reduced   p95\n\nlatency  ")).toBe(
      "Reduced p95 latency",
    );
  });
});

describe("trimToSentence", () => {
  it("returns short text unchanged", () => {
    expect(trimToSentence("Shipped the billing migration.", 200)).toBe(
      "Shipped the billing migration.",
    );
  });

  it("cuts at the last sentence boundary that fits", () => {
    const text =
      "Deployed the API. It worked well. Later we added caching and monitoring.";
    expect(trimToSentence(text, 40)).toBe(
      "Deployed the API. It worked well.",
    );
    expect(trimToSentence(text, 20)).toBe("Deployed the API.");
  });

  it("falls back to a word boundary with an ellipsis", () => {
    expect(
      trimToSentence(
        "Reduced p95 latency from 800ms to 45ms with a composite index",
        30,
      ),
    ).toBe("Reduced p95 latency from 800ms…");
  });
});

describe("bulletLine", () => {
  const log = {
    title: "Fixed order endpoint latency",
    result: "Reduced p95 from 800ms to 45ms.",
    action: "Added a composite index.",
    occurredAt: "2026-03-12",
  };

  it("appends date and tag names in the meta parentheses", () => {
    expect(bulletLine(log, ["Database", "Backend"])).toBe(
      "- **Fixed order endpoint latency** — Reduced p95 from 800ms to 45ms. (2026-03-12 · Database, Backend)",
    );
  });

  it("omits the tag part when there are no tags", () => {
    expect(bulletLine(log, [])).toBe(
      "- **Fixed order endpoint latency** — Reduced p95 from 800ms to 45ms. (2026-03-12)",
    );
  });

  it("falls back to action when result is empty", () => {
    expect(bulletLine({ ...log, result: "" }, [])).toBe(
      "- **Fixed order endpoint latency** — Added a composite index. (2026-03-12)",
    );
  });
});
