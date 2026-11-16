import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

type DashboardBody = {
  stats: {
    achievements: number;
    achievementsThisMonth: number;
    skillsEvidenced: number;
    projectsDocumented: number;
    sparksInbox: number;
  };
};

async function createUser(id: string): Promise<string> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, google_sub, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, `google-sub-${id}`, `${id}@example.com`, `User ${id}`, now, now)
    .run();

  return createSessionToken(id, env.JWT_SECRET);
}

async function request(path: string, token: string): Promise<Response> {
  const headers = new Headers();
  headers.set("Cookie", `${SESSION_COOKIE}=${token}`);
  return app.fetch(new Request(`https://example.com${path}`, { headers }), env);
}

async function getDashboard(token: string): Promise<DashboardBody> {
  const response = await request("/api/dashboard", token);
  expect(response.status).toBe(200);
  return (await response.json()) as DashboardBody;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function insertBragLog(
  userId: string,
  id: string,
  occurredAt: string,
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO brag_logs (id, user_id, title, situation, task, action, result, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, "Shipped", "S", "T", "A", "R", occurredAt, now, now)
    .run();
}

async function insertTagWithLog(
  userId: string,
  tagName: string,
  bragLogId: string,
): Promise<void> {
  const tagId = `tag-${tagName}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
    ).bind(tagId, userId, tagName, Date.now()),
    env.DB.prepare(
      "INSERT OR IGNORE INTO brag_tags (brag_log_id, tag_id) VALUES (?, ?)",
    ).bind(bragLogId, tagId),
  ]);
}

async function insertProject(userId: string, id: string): Promise<void> {
  const now = Date.now();
  const workspaceId = `ws-${userId}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO workspaces (id, user_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(workspaceId, userId, "Workspace", "work", now, now),
    env.DB.prepare(
      "INSERT INTO projects (id, user_id, workspace_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, userId, workspaceId, "Project", "active", now, now),
  ]);
}

async function insertSpark(userId: string, id: string): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO sparks (id, user_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, "A spark", "open", now, now)
    .run();
}

describe("dashboard outcome stats", () => {
  it("returns zeros for a new user", async () => {
    const token = await createUser("dash-empty");

    const body = await getDashboard(token);
    expect(body.stats).toEqual({
      achievements: 0,
      achievementsThisMonth: 0,
      skillsEvidenced: 0,
      projectsDocumented: 0,
      sparksInbox: 0,
    });
  });

  it("counts achievements, this-month achievements, evidenced skills, projects, and open sparks", async () => {
    const token = await createUser("dash-full");
    const userId = "dash-full";

    await insertBragLog(userId, "dash-log-1", todayKey());
    await insertBragLog(userId, "dash-log-2", "2020-01-01");
    await insertTagWithLog(userId, "database", "dash-log-1");
    await insertTagWithLog(userId, "backend", "dash-log-1");
    await insertProject(userId, "dash-project-1");
    await insertSpark(userId, "dash-spark-1");

    const body = await getDashboard(token);
    expect(body.stats).toEqual({
      achievements: 2,
      achievementsThisMonth: 1,
      skillsEvidenced: 2,
      projectsDocumented: 1,
      sparksInbox: 1,
    });
  });

  it("only counts the caller's own records", async () => {
    await createUser("dash-owner");
    const tokenB = await createUser("dash-other");

    await insertBragLog("dash-owner", "dash-owner-log", todayKey());
    await insertTagWithLog("dash-owner", "database", "dash-owner-log");
    await insertProject("dash-owner", "dash-owner-project");

    const body = await getDashboard(tokenB);
    expect(body.stats.achievements).toBe(0);
    expect(body.stats.skillsEvidenced).toBe(0);
    expect(body.stats.projectsDocumented).toBe(0);
  });

  it("requires authentication", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/dashboard"),
      env,
    );
    expect(response.status).toBe(401);
  });
});
