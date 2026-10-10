import { describe, expect, it } from "vitest";

import {
  cleanUrl,
  extractSourcesFromText,
  guessKindFromUrl,
} from "@/client/features/sources/url-extractor";

describe("cleanUrl", () => {
  it("strips trailing sentence punctuation", () => {
    expect(cleanUrl("https://example.com, ")).toBe("https://example.com");
    expect(cleanUrl("https://example.com.")).toBe("https://example.com");
  });

  it("strips unbalanced closing parentheses", () => {
    expect(cleanUrl("https://example.com/docs)")).toBe("https://example.com/docs");
    expect(cleanUrl("https://en.wikipedia.org/wiki/Foo_(bar)")).toBe(
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    );
  });
});

describe("guessKindFromUrl", () => {
  it("detects video and course hosts", () => {
    expect(guessKindFromUrl("https://www.youtube.com/watch?v=1")).toBe("video");
    expect(guessKindFromUrl("https://youtu.be/abc")).toBe("video");
    expect(guessKindFromUrl("https://vimeo.com/12345")).toBe("video");
    expect(guessKindFromUrl("https://www.coursera.org/learn/x")).toBe("course");
    expect(guessKindFromUrl("https://udemy.com/course/x")).toBe("course");
  });

  it("falls back to link", () => {
    expect(guessKindFromUrl("https://blog.cloudflare.com/d1")).toBe("link");
    expect(guessKindFromUrl("not a url")).toBe("link");
  });
});

describe("extractSourcesFromText", () => {
  it("extracts markdown links with their anchor as label", () => {
    const sources = extractSourcesFromText(
      "See [Martin Fowler Guide](https://martinfowler.com/articles/refactoring.html) for more.",
    );

    expect(sources).toEqual([
      {
        url: "https://martinfowler.com/articles/refactoring.html",
        label: "Martin Fowler Guide",
        kind: "article",
        locator: "",
      },
    ]);
  });

  it("extracts raw urls and labels them by hostname", () => {
    const sources = extractSourcesFromText(
      "Deployed on https://blog.cloudflare.com/d1 today.",
    );

    expect(sources).toEqual([
      {
        url: "https://blog.cloudflare.com/d1",
        label: "blog.cloudflare.com",
        kind: "link",
        locator: "",
      },
    ]);
  });

  it("ignores markdown image embeds", () => {
    const sources = extractSourcesFromText(
      "![screenshot](https://cdn.example.com/shot.png)\n\nhttps://example.com",
    );

    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe("https://example.com");
  });

  it("deduplicates urls and skips existing ones", () => {
    const sources = extractSourcesFromText(
      "https://example.com and https://example.com\n[dup](https://example.com)",
      ["https://example.com"],
    );

    expect(sources).toEqual([]);
  });

  it("matches duplicate raw and markdown links once", () => {
    const sources = extractSourcesFromText(
      "[Example](https://example.com) and https://example.com",
    );

    expect(sources).toHaveLength(1);
    expect(sources[0].label).toBe("Example");
  });

  it("keeps a youtube markdown link as video", () => {
    const sources = extractSourcesFromText(
      "[Intro talk](https://www.youtube.com/watch?v=abc)",
    );

    expect(sources[0]).toMatchObject({ kind: "video" });
  });
});
