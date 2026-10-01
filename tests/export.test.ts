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

async function createWorkspace(token: string, name: string): Promise<string> {
  const response = await request("/api/workspaces", token, {
    method: "POST",
    body: JSON.stringify({ name, type: "work" }),
  });
  const body = (await response.json()) as { workspace: { id: string } };
  return body.workspace.id;
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
    workspaceId: string;
    tagId: string;
  },
): Promise<void> {
  const response = await request("/api/brag-logs", token, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      situation: "The situation",
      task: "The task",
      action: "The action",
      result: "The result",
      occurred_at: input.occurredAt,
      workspace_id: input.workspaceId,
      tag_ids: [input.tagId],
    }),
  });
  expect(response.status).toBe(201);
}

describe("brag log markdown export", () => {
  it("streams a Markdown attachment with STAR sections", async () => {
    const token = await createUser("export-user");
    const workspaceId = await createWorkspace(token, "Platform");
    const tagId = await createTag(token, "Reliability");

    await createBragLog(token, {
      title: "Reduced p99 latency",
      occurredAt: "2026-02-10",
      workspaceId,
      tagId,
    });

    const response = await request("/api/export/brag-logs", token);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain(
      "brag-logs.md",
    );

    const markdown = await response.text();
    expect(markdown).toContain("# Brag Logs");
    expect(markdown).toContain("## Reduced p99 latency");
    expect(markdown).toContain("**Workspace:** Platform");
    expect(markdown).toContain("**Tags:** Reliability");
    expect(markdown).toContain("### Situation");
    expect(markdown).toContain("### Task");
    expect(markdown).toContain("### Action");
    expect(markdown).toContain("### Result");
  });

  it("filters by the occurred date range", async () => {
    const token = await createUser("export-range-user");
    const workspaceId = await createWorkspace(token, "Range");
    const tagId = await createTag(token, "RangeTag");

    await createBragLog(token, {
      title: "January win",
      occurredAt: "2026-01-05",
      workspaceId,
      tagId,
    });
    await createBragLog(token, {
      title: "March win",
      occurredAt: "2026-03-15",
      workspaceId,
      tagId,
    });

    const response = await request(
      "/api/export/brag-logs?from=2026-02-01&to=2026-12-31",
      token,
    );
    expect(response.status).toBe(200);
    const markdown = await response.text();
    expect(markdown).toContain("## March win");
    expect(markdown).not.toContain("## January win");
  });

  it("rejects unauthenticated export", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/export/brag-logs"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
