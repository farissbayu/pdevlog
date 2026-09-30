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

type BragLogBody = {
  bragLog: {
    id: string;
    title: string;
    occurredAt: string;
    workspaceId: string | null;
    tags: { id: string; name: string }[];
  };
};

function logPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Shipped the billing migration",
    situation: "Legacy invoices were stored in a fragile format.",
    task: "Migrate all invoices without downtime.",
    action: "Wrote a backfill job and ran it behind a feature flag.",
    result: "Zero downtime and 100% of invoices migrated.",
    occurred_at: "2026-01-15",
    ...overrides,
  };
}

async function createBragLog(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: BragLogBody }> {
  const response = await request("/api/brag-logs", token, {
    method: "POST",
    body: JSON.stringify(logPayload(overrides)),
  });
  return {
    status: response.status,
    body: (await response.json()) as BragLogBody,
  };
}

describe("brag log isolation and relation ownership", () => {
  it("persists tags and workspace for the owner", async () => {
    const tokenA = await createUser("brag-owner");
    const workspaceId = await createWorkspace(tokenA, "Acme Platform");
    const dockerTag = await createTag(tokenA, "Docker");
    const sqlTag = await createTag(tokenA, "SQL");

    const created = await createBragLog(tokenA, {
      workspace_id: workspaceId,
      tag_ids: [dockerTag, sqlTag],
    });

    expect(created.status).toBe(201);
    expect(created.body.bragLog.workspaceId).toBe(workspaceId);
    expect(created.body.bragLog.occurredAt).toBe("2026-01-15");
    expect(created.body.bragLog.tags.map((tag) => tag.id).sort()).toEqual(
      [dockerTag, sqlTag].sort(),
    );

    const detail = await request(
      `/api/brag-logs/${created.body.bragLog.id}`,
      tokenA,
    );
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as BragLogBody;
    expect(detailBody.bragLog.tags).toHaveLength(2);

    const list = (await (
      await request("/api/brag-logs", tokenA)
    ).json()) as { bragLogs: unknown[] };
    expect(list.bragLogs).toHaveLength(1);
  });

  it("touches the workspace updatedAt when a log is added", async () => {
    const token = await createUser("touch-user");
    const workspaceId = await createWorkspace(token, "Touched workspace");

    await env.DB.prepare(
      "UPDATE workspaces SET updated_at = 0 WHERE id = ?",
    )
      .bind(workspaceId)
      .run();

    await createBragLog(token, { workspace_id: workspaceId });

    const row = await env.DB.prepare(
      "SELECT updated_at FROM workspaces WHERE id = ?",
    )
      .bind(workspaceId)
      .first<{ updated_at: number }>();

    expect(row?.updated_at).toBeGreaterThan(0);
  });

  it("updates fields and syncs junction tags for the owner", async () => {
    const token = await createUser("log-updater");
    const dockerTag = await createTag(token, "Docker");
    const sqlTag = await createTag(token, "SQL");

    const created = await createBragLog(token, { tag_ids: [dockerTag] });
    const logId = created.body.bragLog.id;

    const updated = await request(`/api/brag-logs/${logId}`, token, {
      method: "PUT",
      body: JSON.stringify({ title: "Updated title", tag_ids: [sqlTag] }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as BragLogBody;
    expect(updatedBody.bragLog.title).toBe("Updated title");
    expect(updatedBody.bragLog.tags.map((tag) => tag.id)).toEqual([sqlTag]);

    const cleared = await request(`/api/brag-logs/${logId}`, token, {
      method: "PUT",
      body: JSON.stringify({ tag_ids: [] }),
    });
    const clearedBody = (await cleared.json()) as BragLogBody;
    expect(clearedBody.bragLog.tags).toHaveLength(0);
  });

  it("blocks cross-user read, update and delete with 404", async () => {
    const tokenA = await createUser("log-user-a");
    const tokenB = await createUser("log-user-b");

    const created = await createBragLog(tokenA);
    expect(created.status).toBe(201);
    const logId = created.body.bragLog.id;

    const ownRead = await request(`/api/brag-logs/${logId}`, tokenA);
    expect(ownRead.status).toBe(200);

    const crossRead = await request(`/api/brag-logs/${logId}`, tokenB);
    expect(crossRead.status).toBe(404);

    const crossUpdate = await request(`/api/brag-logs/${logId}`, tokenB, {
      method: "PUT",
      body: JSON.stringify({ title: "Hijacked" }),
    });
    expect(crossUpdate.status).toBe(404);

    const crossDelete = await request(`/api/brag-logs/${logId}`, tokenB, {
      method: "DELETE",
    });
    expect(crossDelete.status).toBe(404);

    const listB = (await (
      await request("/api/brag-logs", tokenB)
    ).json()) as { bragLogs: unknown[] };
    expect(listB.bragLogs).toHaveLength(0);
  });

  it("rejects attaching a tag owned by another user with 404", async () => {
    const tokenA = await createUser("tag-owner-a");
    const tokenB = await createUser("tag-thief-b");

    const tagId = await createTag(tokenA, "Owned by A");

    const attempt = await createBragLog(tokenB, { tag_ids: [tagId] });
    expect(attempt.status).toBe(404);

    const listB = (await (
      await request("/api/brag-logs", tokenB)
    ).json()) as { bragLogs: unknown[] };
    expect(listB.bragLogs).toHaveLength(0);
  });

  it("rejects attaching a workspace owned by another user with 404", async () => {
    const tokenA = await createUser("ws-owner-a");
    const tokenB = await createUser("ws-thief-b");

    const workspaceId = await createWorkspace(tokenA, "Owned by A");

    const attempt = await createBragLog(tokenB, {
      workspace_id: workspaceId,
    });
    expect(attempt.status).toBe(404);

    const listB = (await (
      await request("/api/brag-logs", tokenB)
    ).json()) as { bragLogs: unknown[] };
    expect(listB.bragLogs).toHaveLength(0);
  });

  it("rejects unauthenticated access to brag logs", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/brag-logs"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
