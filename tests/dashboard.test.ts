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
  title = "A win",
): Promise<string> {
  const response = await request("/api/brag-logs", token, {
    method: "POST",
    body: JSON.stringify({
      title,
      situation: "s",
      task: "t",
      action: "a",
      result: "r",
      occurred_at: "2026-02-01",
      workspace_id: workspaceId,
    }),
  });
  const body = (await response.json()) as { bragLog: { id: string } };
  return body.bragLog.id;
}

async function createLearningNote(
  token: string,
  workspaceId: string,
  title = "A note",
): Promise<string> {
  const response = await request("/api/learning-notes", token, {
    method: "POST",
    body: JSON.stringify({
      title,
      content: "## Note",
      workspace_id: workspaceId,
    }),
  });
  const body = (await response.json()) as { learningNote: { id: string } };
  return body.learningNote.id;
}

async function setCreatedAt(
  table: "brag_logs" | "learning_notes",
  id: string,
  value: number,
): Promise<void> {
  await env.DB.prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`)
    .bind(value, id)
    .run();
}

type DashboardBody = {
  stats: { workspaces: number; bragLogs: number; learningNotes: number };
  recentWorkspaces: { id: string }[];
};

type RecentActivityBody = {
  items: {
    id: string;
    type: "brag-log" | "learning-note";
    title: string;
  }[];
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

  it("merges brag logs and learning notes in reverse chronological order", async () => {
    const tokenA = await createUser("dash-recent-a");
    const tokenB = await createUser("dash-recent-b");

    const workspaceA = await createWorkspace(tokenA, "Recent A");
    const workspaceB = await createWorkspace(tokenB, "Recent B");

    const oldest = await createBragLog(tokenA, workspaceA, "Oldest log");
    const middle = await createLearningNote(tokenA, workspaceA, "Middle note");
    const newest = await createBragLog(tokenA, workspaceA, "Newest log");
    const other = await createBragLog(tokenB, workspaceB, "Other user log");

    await setCreatedAt("brag_logs", oldest, 1000);
    await setCreatedAt("learning_notes", middle, 2000);
    await setCreatedAt("brag_logs", newest, 3000);
    await setCreatedAt("brag_logs", other, 4000);

    const response = await request("/api/dashboard/recent", tokenA);
    expect(response.status).toBe(200);
    const body = (await response.json()) as RecentActivityBody;

    expect(body.items.map((item) => item.id)).toEqual([
      newest,
      middle,
      oldest,
    ]);
    expect(body.items.map((item) => item.type)).toEqual([
      "brag-log",
      "learning-note",
      "brag-log",
    ]);
  });

  it("caps recent activity at ten items", async () => {
    const token = await createUser("dash-recent-cap");
    const workspace = await createWorkspace(token, "Cap");

    for (let index = 0; index < 12; index += 1) {
      await createBragLog(token, workspace, `Log ${index}`);
    }

    const response = await request("/api/dashboard/recent", token);
    expect(response.status).toBe(200);
    const body = (await response.json()) as RecentActivityBody;
    expect(body.items).toHaveLength(10);
  });

  it("rejects unauthenticated access to recent activity", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/dashboard/recent"),
      env,
    );

    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated access to the dashboard", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/dashboard"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
