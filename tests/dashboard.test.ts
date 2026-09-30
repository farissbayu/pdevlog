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

async function createBragLog(
  token: string,
  workspaceId: string,
): Promise<void> {
  await request("/api/brag-logs", token, {
    method: "POST",
    body: JSON.stringify({
      title: "A win",
      situation: "s",
      task: "t",
      action: "a",
      result: "r",
      occurred_at: "2026-02-01",
      workspace_id: workspaceId,
    }),
  });
}

type DashboardBody = {
  stats: { workspaces: number; bragLogs: number; learningNotes: number };
  recentWorkspaces: { id: string }[];
};

describe("dashboard summary", () => {
  it("reports counts and recent workspaces for the current user", async () => {
    const tokenA = await createUser("dash-a");
    const tokenB = await createUser("dash-b");

    const withLog = await createWorkspace(tokenA, "With a log");
    const stale = await createWorkspace(tokenA, "Stale workspace");
    await env.DB.prepare("UPDATE workspaces SET updated_at = 0 WHERE id = ?")
      .bind(stale)
      .run();

    await createBragLog(tokenA, withLog);

    await createWorkspace(tokenB, "Other user workspace");

    const response = await request("/api/dashboard", tokenA);
    expect(response.status).toBe(200);
    const body = (await response.json()) as DashboardBody;

    expect(body.stats).toEqual({
      workspaces: 2,
      bragLogs: 1,
      learningNotes: 0,
    });
    expect(body.recentWorkspaces).toHaveLength(2);
    expect(body.recentWorkspaces[0].id).toBe(withLog);
  });

  it("rejects unauthenticated access to the dashboard", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/dashboard"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
