import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

async function createUser(id: string): Promise<string> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, google_sub, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, `google-sub-${id}`, `${id}@example.com`, `User ${id}`, now, now)
    .run();

  return createSessionToken(id, env.JWT_SECRET);
}

async function request(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Cookie", `${SESSION_COOKIE}=${token}`);
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return app.fetch(
    new Request(`https://example.com${path}`, { ...init, headers }),
    env,
  );
}

async function createTag(token: string, name: string): Promise<string> {
  const response = await request("/api/tags", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const body = (await response.json()) as { tag: { id: string } };
  return body.tag.id;
}

async function createBragLog(
  token: string,
  input: {
    title: string;
    occurredAt: string;
    tagIds?: string[];
    result?: string;
  },
): Promise<void> {
  const response = await request("/api/brag-logs", token, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      situation: "The situation",
      task: "The task",
      action: "Added a composite index and batched the query.",
      result: input.result ?? "Reduced p95 from 800ms to 45ms.",
      occurred_at: input.occurredAt,
      tag_ids: input.tagIds ?? [],
    }),
  });
  expect(response.status).toBe(201);
}

function bulletLines(markdown: string): string[] {
  return markdown.split("\n").filter((line) => line.startsWith("- **"));
}

describe("brag log bullets export", () => {
  it("rejects unauthenticated export", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/export/brag-logs?format=bullets"),
      env,
    );

    expect(response.status).toBe(401);
  });

  it("renders one bullet line per log with tags", async () => {
    const token = await createUser("bullets-owner");
    const dockerTag = await createTag(token, "Docker");
    const sqlTag = await createTag(token, "SQL");

    await createBragLog(token, {
      title: "Fixed order endpoint latency",
      occurredAt: "2026-01-15",
      tagIds: [dockerTag, sqlTag],
    });
    await createBragLog(token, {
      title: "Migrated billing to D1",
      occurredAt: "2026-02-10",
    });

    const response = await request(
      "/api/export/brag-logs?format=bullets",
      token,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");

    const markdown = await response.text();
    expect(markdown).toContain("# Brag Log Bullets");
    expect(markdown).toContain("> 2 entries · beginning → today");

    const lines = bulletLines(markdown);
    expect(lines).toHaveLength(2);

    const tagged = lines.find((line) =>
      line.includes("**Fixed order endpoint latency**"),
    );
    expect(tagged).toContain("Reduced p95 from 800ms to 45ms.");
    expect(tagged).toContain("(2026-01-15 · ");
    expect(tagged).toContain("Docker");
    expect(tagged).toContain("SQL");

    const untagged = lines.find((line) =>
      line.includes("**Migrated billing to D1**"),
    );
    expect(untagged).toContain("(2026-02-10)");
    expect(lines.join("\n")).not.toContain("---");
  });

  it("keeps the STAR output unchanged", async () => {
    const token = await createUser("star-owner");
    await createBragLog(token, {
      title: "Reduced p99 latency",
      occurredAt: "2026-02-10",
    });

    const response = await request("/api/export/brag-logs?format=star", token);
    expect(response.status).toBe(200);

    const markdown = await response.text();
    expect(markdown).toContain("# Brag Logs");
    expect(markdown).toContain("## Reduced p99 latency");
    expect(markdown).toContain("### Situation");
    expect(markdown).not.toContain("# Brag Log Bullets");
  });

  it("names the bullets attachment brag-log-bullets.md", async () => {
    const token = await createUser("bullets-filename");
    await createBragLog(token, {
      title: "Export filename check",
      occurredAt: "2026-03-01",
    });

    const response = await request(
      "/api/export/brag-logs?format=bullets",
      token,
    );
    expect(response.headers.get("content-disposition")).toContain(
      "brag-log-bullets.md",
    );
  });

  it("filters bullets by the occurred date range", async () => {
    const token = await createUser("bullets-range");
    await createBragLog(token, {
      title: "January win",
      occurredAt: "2026-01-05",
    });
    await createBragLog(token, {
      title: "March win",
      occurredAt: "2026-03-15",
    });

    const response = await request(
      "/api/export/brag-logs?format=bullets&from=2026-02-01&to=2026-12-31",
      token,
    );
    expect(response.status).toBe(200);

    const markdown = await response.text();
    expect(markdown).toContain("> 1 entries · 2026-02-01 → 2026-12-31");
    expect(markdown).toContain("**March win**");
    expect(markdown).not.toContain("January win");
    expect(bulletLines(markdown)).toHaveLength(1);
  });

  it("never exposes another user's logs", async () => {
    const tokenA = await createUser("bullets-user-a");
    const tokenB = await createUser("bullets-user-b");

    await createBragLog(tokenA, {
      title: "Private win of A",
      occurredAt: "2026-04-01",
    });

    const response = await request(
      "/api/export/brag-logs?format=bullets",
      tokenB,
    );
    expect(response.status).toBe(200);

    const markdown = await response.text();
    expect(markdown).not.toContain("Private win of A");
    expect(markdown).toContain("_No brag logs found for the selected range._");
    expect(bulletLines(markdown)).toHaveLength(0);
  });
});
