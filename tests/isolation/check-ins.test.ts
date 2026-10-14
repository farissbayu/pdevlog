import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

const DAY_MS = 86_400_000;

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

function utcDayKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

function noonUtc(daysAgo: number): number {
  return Date.parse(`${utcDayKey(daysAgo)}T12:00:00.000Z`);
}

async function insertBragLog(
  userId: string,
  id: string,
  createdAt: number,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO brag_logs (id, user_id, title, situation, task, action, result, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      userId,
      "Shipped something",
      "Situation",
      "Task",
      "Action",
      "Result",
      "2026-01-01",
      createdAt,
      createdAt,
    )
    .run();
}

async function insertNote(
  userId: string,
  id: string,
  createdAt: number,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO notes (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, "Note", "Content", createdAt, createdAt)
    .run();
}

async function insertSpark(
  userId: string,
  id: string,
  createdAt: number,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO sparks (id, user_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, "A spark", "open", createdAt, createdAt)
    .run();
}

async function insertProjectItem(
  userId: string,
  id: string,
  values: { status: "shipped" | "in_progress"; shippedAt: number | null },
): Promise<void> {
  const workspaceId = `ws-${userId}`;
  const projectId = `project-${userId}`;
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO workspaces (id, user_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(workspaceId, userId, "Workspace", "work", now, now),
    env.DB.prepare(
      "INSERT OR IGNORE INTO projects (id, user_id, workspace_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(projectId, userId, workspaceId, "Project", "active", now, now),
    env.DB.prepare(
      "INSERT INTO project_items (id, user_id, project_id, title, kind, status, target_version, position, shipped_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      id,
      userId,
      projectId,
      "Item",
      "feat",
      values.status,
      "Next",
      0,
      values.shippedAt,
      now,
      now,
    ),
  ]);
}

type CheckInsBody = {
  days: {
    date: string;
    total: number;
    bragLogs: number;
    notes: number;
    sparks: number;
    projectItems: number;
  }[];
  currentStreak: number;
  longestStreak: number;
  todayActive: boolean;
};

async function getCheckIns(
  token: string,
  query = "",
): Promise<CheckInsBody> {
  const response = await request(`/api/dashboard/check-ins${query}`, token);
  expect(response.status).toBe(200);
  return (await response.json()) as CheckInsBody;
}

describe("daily check-ins", () => {
  it("returns an empty summary for a new user", async () => {
    const token = await createUser("checkin-empty");

    const body = await getCheckIns(token);
    expect(body).toEqual({
      days: [],
      currentStreak: 0,
      longestStreak: 0,
      todayActive: false,
    });
  });

  it("counts all four sources and ignores unshipped items", async () => {
    const token = await createUser("checkin-sources");
    const today = noonUtc(0);

    await insertBragLog("checkin-sources", "brag-1", today);
    await insertNote("checkin-sources", "note-1", today);
    await insertSpark("checkin-sources", "spark-1", today);
    await insertProjectItem("checkin-sources", "item-1", {
      status: "shipped",
      shippedAt: today,
    });
    await insertProjectItem("checkin-sources", "item-2", {
      status: "in_progress",
      shippedAt: today,
    });

    const body = await getCheckIns(token);
    expect(body.days).toEqual([
      {
        date: utcDayKey(0),
        total: 4,
        bragLogs: 1,
        notes: 1,
        sparks: 1,
        projectItems: 1,
      },
    ]);
    expect(body.currentStreak).toBe(1);
    expect(body.longestStreak).toBe(1);
    expect(body.todayActive).toBe(true);
  });

  it("computes current and longest streaks across a gap", async () => {
    const token = await createUser("checkin-streaks");

    for (const daysAgo of [0, 1, 2, 10, 11, 12, 13]) {
      await insertSpark(
        "checkin-streaks",
        `checkin-streaks-spark-${daysAgo}`,
        noonUtc(daysAgo),
      );
    }

    const body = await getCheckIns(token);
    expect(body.days).toHaveLength(7);
    expect(body.currentStreak).toBe(3);
    expect(body.longestStreak).toBe(4);
    expect(body.todayActive).toBe(true);
  });

  it("keeps the streak alive through yesterday and resets after a gap", async () => {
    const yesterdayToken = await createUser("checkin-yesterday");
    await insertSpark("checkin-yesterday", "spark-y", noonUtc(1));

    const yesterdayBody = await getCheckIns(yesterdayToken);
    expect(yesterdayBody.currentStreak).toBe(1);
    expect(yesterdayBody.todayActive).toBe(false);

    const gapToken = await createUser("checkin-gap");
    await insertSpark("checkin-gap", "spark-gap", noonUtc(2));

    const gapBody = await getCheckIns(gapToken);
    expect(gapBody.currentStreak).toBe(0);
    expect(gapBody.longestStreak).toBe(1);
  });

  it("buckets days by the client timezone offset", async () => {
    const token = await createUser("checkin-timezone");
    const timestamp = Date.parse("2026-01-10T18:00:00.000Z");
    await insertSpark("checkin-timezone", "spark-tz", timestamp);

    const utcBody = await getCheckIns(token, "?tz_offset=0");
    expect(utcBody.days.map((day) => day.date)).toEqual(["2026-01-10"]);

    const offsetBody = await getCheckIns(token, "?tz_offset=420");
    expect(offsetBody.days.map((day) => day.date)).toEqual(["2026-01-11"]);
  });

  it("only exposes the caller's activity", async () => {
    const tokenA = await createUser("checkin-owner-a");
    const tokenB = await createUser("checkin-owner-b");
    await insertSpark("checkin-owner-a", "spark-a", noonUtc(0));
    await insertSpark("checkin-owner-b", "spark-b", noonUtc(0));

    const bodyA = await getCheckIns(tokenA);
    expect(bodyA.days).toEqual([
      {
        date: utcDayKey(0),
        total: 1,
        bragLogs: 0,
        notes: 0,
        sparks: 1,
        projectItems: 0,
      },
    ]);

    const bodyB = await getCheckIns(tokenB);
    expect(bodyB.days[0]?.total).toBe(1);
  });

  it("validates tz_offset and requires authentication", async () => {
    const token = await createUser("checkin-validation");

    const outOfRange = await request(
      "/api/dashboard/check-ins?tz_offset=9999",
      token,
    );
    expect(outOfRange.status).toBe(400);

    const notANumber = await request(
      "/api/dashboard/check-ins?tz_offset=abc",
      token,
    );
    expect(notANumber.status).toBe(400);

    const unauthenticated = await app.fetch(
      new Request("https://example.com/api/dashboard/check-ins"),
      env,
    );
    expect(unauthenticated.status).toBe(401);
  });
});
