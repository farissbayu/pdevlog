import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

const GAP_ID = "gap-1";

async function createUser(id: string): Promise<string> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, google_sub, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, `google-sub-${id}`, `${id}@example.com`, `User ${id}`, now, now)
    .run();
  return createSessionToken(id, env.JWT_SECRET);
}

async function seedGrowthArea(userId: string): Promise<void> {
  const now = Date.now();
  const insights = {
    archetype: "Test Engineer",
    summary: "A summary.",
    strengths: [],
    growthAreas: [
      {
        id: GAP_ID,
        area: "Observability",
        gap: "No metrics or logging.",
        recommendation: "Add structured logs and metrics.",
      },
    ],
    recommendedNextSteps: [],
    analyzedAt: "2026-01-01T00:00:00.000Z",
  };

  await env.DB.prepare(
    "INSERT INTO user_profiles (user_id, primary_stack, skill_insights, insights_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(userId, "[]", JSON.stringify(insights), "ready", now, now)
    .run();
}

async function request(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Cookie", `${SESSION_COOKIE}=${token}`);

  const ctx = createExecutionContext();
  const response = await app.fetch(
    new Request(`https://example.com${path}`, { ...init, headers }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

const caseStudyPath = `/api/profile/growth-areas/${GAP_ID}/case-study`;

function stubCaseStudyAi() {
  const brief = {
    title: "Case Study: Derive Observability Signals",
    principle: "You cannot debug what you cannot observe.",
    caseStudy: "One request path that fails intermittently in production.",
    reasoningSteps: [
      "List the failure modes you cannot currently explain.",
      "Derive the minimum signals needed to distinguish them.",
    ],
    deliverable: "A written signal plan and structured logs for one path.",
    definitionOfDone: ["Logs emitted for each request"],
    estimatedHours: 6,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(brief) } }],
          usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  return brief;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("on-demand case study isolation tests", () => {
  it("generates a case study brief for the owner and saves it as an unassigned note", async () => {
    const token = await createUser("case-user-a");
    await seedGrowthArea("case-user-a");
    const expected = stubCaseStudyAi();

    const res = await request(caseStudyPath, token, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { brief: { title: string } };
    expect(body.brief.title).toBe(expected.title);

    const noteRes = await request("/api/notes", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: body.brief.title,
        content: `## Principle\n${expected.principle}`,
      }),
    });
    expect(noteRes.status).toBe(201);
    const note = (await noteRes.json()) as {
      note: { workspaceId: string | null; title: string };
    };
    expect(note.note.workspaceId).toBeNull();
    expect(note.note.title).toBe(expected.title);
  });

  it("returns 404 when another user targets someone else's growth area", async () => {
    await createUser("case-user-b");
    await seedGrowthArea("case-user-b");

    const tokenC = await createUser("case-user-c");
    const res = await request(caseStudyPath, tokenC, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown growth area", async () => {
    const token = await createUser("case-user-d");
    await seedGrowthArea("case-user-d");

    const res = await request(
      "/api/profile/growth-areas/missing-gap/case-study",
      token,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the user has no profile", async () => {
    const token = await createUser("case-user-e");
    const res = await request(caseStudyPath, token, { method: "POST" });
    expect(res.status).toBe(404);
  });
});
