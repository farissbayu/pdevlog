import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
  waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import type { AiJobMessage } from "@/worker/features/profile/queue";
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

  const ctx = createExecutionContext();
  const response = await app.fetch(
    new Request(`https://example.com${path}`, { ...init, headers }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

async function runQueuedAiJob(body: AiJobMessage): Promise<void> {
  const batch = createMessageBatch<AiJobMessage>("pdevlog-ai-jobs", [
    { id: crypto.randomUUID(), timestamp: new Date(), attempts: 1, body },
  ]);
  const ctx = createExecutionContext();
  await app.queue(batch, env, ctx);
  await getQueueResult(batch, ctx);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("profile and CV skill mapping isolation tests", () => {
  it("creates and retrieves user profile on first access", async () => {
    const token = await createUser("profile-user-1");

    const res = await request("/api/profile", token);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      userId: string;
      email: string;
      headline: string | null;
      primaryStack: string[];
      cvMarkdown: string | null;
    };

    expect(body.userId).toBe("profile-user-1");
    expect(body.email).toBe("profile-user-1@example.com");
    expect(body.headline).toBeNull();
    expect(body.primaryStack).toEqual([]);
    expect(body.cvMarkdown).toBeNull();
  });

  it("updates headline, bio, and primary stack via PATCH", async () => {
    const token = await createUser("profile-user-2");

    const patchRes = await request("/api/profile", token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: "Staff Product Engineer",
        bio: "Specializing in resilient systems and optimistic client architectures.",
        primaryStack: ["React", "TypeScript", "Cloudflare Workers", "Drizzle"],
      }),
    });

    expect(patchRes.status).toBe(200);
    const body = (await patchRes.json()) as {
      headline: string;
      bio: string;
      primaryStack: string[];
    };

    expect(body.headline).toBe("Staff Product Engineer");
    expect(body.primaryStack).toEqual([
      "React",
      "TypeScript",
      "Cloudflare Workers",
      "Drizzle",
    ]);
  });

  it("uploads and saves Markdown CV content", async () => {
    const token = await createUser("profile-user-3");

    const cvText = `# Jane Doe - Senior Product Engineer
## Experience
- Architected optimistic client mutations and real-time state sync handling 50k DAU.
- Designed relational schemas in SQLite/D1 and handled zero-downtime migrations.
- Instrumented PostHog event telemetry and Sentry error boundaries across onboarding funnels.
`;

    const formData = new FormData();
    const file = new File([cvText], "resume.md", { type: "text/markdown" });
    formData.append("file", file);

    const mockExtraction = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              headline: "Senior Product Engineer",
              bio: "Specializing in optimistic client mutations.",
              primaryStack: ["React", "TypeScript", "SQLite"],
              markdown: cvText,
            }),
          },
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockExtraction), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const uploadRes = await request("/api/profile/cv/upload", token, {
      method: "POST",
      body: formData,
    });

    expect(uploadRes.status).toBe(202);
    const body = (await uploadRes.json()) as { status: string };
    expect(body.status).toBe("processing");

    const listed = await env.STORAGE.list({
      prefix: "cv-uploads/profile-user-3/",
    });
    const key = listed.objects[0]?.key;
    expect(key).toBeDefined();
    await runQueuedAiJob({
      kind: "cv",
      userId: "profile-user-3",
      key: key as string,
      name: "resume.md",
      type: "text/markdown",
    });

    // Verify it is persisted in profile after the queued job completes
    const profileRes = await request("/api/profile", token);
    const profile = (await profileRes.json()) as {
      cvMarkdown: string;
      headline: string;
      bio: string;
      cvParseStatus: string;
    };
    expect(profile.cvMarkdown).toContain("Jane Doe");
    expect(profile.cvMarkdown).toContain("optimistic client mutations");
    expect(profile.headline).toBe("Senior Product Engineer");
    expect(profile.bio).toBe("Specializing in optimistic client mutations.");
    expect(profile.cvParseStatus).toBe("ready");
  });

  it("extracts persona details (headline, bio, stack) from saved CV via POST /api/profile/persona/extract", async () => {
    const token = await createUser("profile-user-persona");

    const cvText = `# John Smith - Staff Systems Architect\n\nExperienced distributed systems engineer.`;
    await request("/api/profile", token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cvMarkdown: cvText }),
    });

    const mockExtraction = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              headline: "Staff Systems Architect",
              bio: "Specializing in distributed telemetry and fault tolerance.",
              primaryStack: ["Go", "Kubernetes", "Kafka"],
              markdown: cvText,
            }),
          },
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockExtraction), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const res = await request("/api/profile/persona/extract", token, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      headline: string;
      bio: string;
      primaryStack: string[];
    };

    expect(body.headline).toBe("Staff Systems Architect");
    expect(body.bio).toBe(
      "Specializing in distributed telemetry and fault tolerance.",
    );
    expect(body.primaryStack).toContain("Go");
  });

  it("analyzes skills and generates dynamic competency insights (strengths, growth areas, next steps)", async () => {
    const token = await createUser("profile-user-5");

    // Upload CV
    await request("/api/profile", token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cvMarkdown: `# Jane Doe - Senior Product Engineer\n\n- Built scalable React applications with TypeScript.\n- Designed database schemas in SQLite and Postgres.\n- Shipped user-facing features end to end.`,
      }),
    });

    const reality = {
      archetype: "Product-Centric Fullstack Engineer",
      summary:
        "Strong fullstack engineer with proven execution across user-facing frontend and backend services.",
      strengths: [
        {
          area: "Frontend Architecture & UI Craft",
          description:
            "High velocity building interactive apps with React and TypeScript.",
          evidenceSummary: "Built scalable React applications with TypeScript.",
          evidenceLogIds: [],
        },
        {
          area: "Relational Database Design",
          description:
            "Pragmatic modeling and migrations using SQLite and Postgres.",
          evidenceSummary: "Designed database schemas in SQLite and Postgres.",
          evidenceLogIds: [],
        },
      ],
      productionStack: ["React", "TypeScript", "SQLite"],
      observedPatterns: ["Relational CRUD", "SPA with Client State"],
      recommendedNextSteps: [
        "Log architectural decisions around high-concurrency systems.",
      ],
    };
    const audit = {
      criticalGaps: [
        {
          area: "Distributed Systems & Scalability",
          gap: "Limited evidence of message brokers or distributed caching.",
          whyItMattersForSoloDev:
            "Single points of failure under load without retries.",
        },
      ],
    };

    const makeCompletion = (payload: unknown) =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify(payload) } },
          ],
          usage: {
            prompt_tokens: 40,
            completion_tokens: 30,
            total_tokens: 70,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeCompletion(reality))
        .mockResolvedValueOnce(makeCompletion(audit)),
    );

    const analyzeRes = await request("/api/profile/skills/analyze", token, {
      method: "POST",
    });

    expect(analyzeRes.status).toBe(202);
    const analyzeData = (await analyzeRes.json()) as { status: string };
    expect(analyzeData.status).toBe("analyzing");

    await runQueuedAiJob({ kind: "skills", userId: "profile-user-5" });

    // Verify GET /api/profile returns the saved skillInsights after the job
    const profileRes = await request("/api/profile", token);
    const profileData = (await profileRes.json()) as {
      headline: string;
      skillInsights: {
        archetype: string;
        strengths: { area: string }[];
        growthAreas: { area: string; gap: string; recommendation: string }[];
      };
      skillAnalyzedAt: string | null;
      insightsStatus: string;
    };

    expect(profileData.headline).toBe("Product-Centric Fullstack Engineer");
    expect(profileData.skillInsights.archetype).toBe(
      "Product-Centric Fullstack Engineer",
    );
    expect(profileData.skillInsights.strengths).toHaveLength(2);
    expect(profileData.skillInsights.growthAreas).toEqual([
      {
        id: expect.any(String),
        area: "Distributed Systems & Scalability",
        gap: "Limited evidence of message brokers or distributed caching.",
        recommendation: "Single points of failure under load without retries.",
      },
    ]);
    expect(profileData.skillAnalyzedAt).not.toBeNull();
    expect(profileData.insightsStatus).toBe("ready");
  });

  it("links skill strengths to supporting brag logs and drops invented evidence ids", async () => {
    const token = await createUser("profile-user-evidence");

    await request("/api/profile", token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cvMarkdown:
          "# Jane Doe - Senior Product Engineer\n\n- Built scalable React applications with TypeScript.",
      }),
    });

    const knownId = "brag-log-evidence-1";
    await env.DB.prepare(
      "INSERT INTO brag_logs (id, user_id, title, situation, task, action, result, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        knownId,
        "profile-user-evidence",
        "Shipped auth",
        "Users needed login",
        "Add auth",
        "Built OAuth flow",
        "Shipped OAuth login",
        "2026-01-01",
      )
      .run();

    const reality = {
      archetype: "Product-Centric Fullstack Engineer",
      summary: "Strong fullstack engineer with proven execution.",
      strengths: [
        {
          area: "Frontend Architecture & UI Craft",
          description: "High velocity building interactive apps with React.",
          evidenceSummary: "Built scalable React applications with TypeScript.",
          evidenceLogIds: [knownId, "invented-id"],
        },
      ],
      productionStack: ["React", "TypeScript"],
      observedPatterns: ["SPA with Client State"],
      recommendedNextSteps: ["Log architectural decisions."],
    };
    const audit = {
      criticalGaps: [
        {
          area: "Distributed Systems & Scalability",
          gap: "Limited evidence of message brokers.",
          whyItMattersForSoloDev: "Single points of failure under load.",
        },
      ],
    };

    const makeCompletion = (payload: unknown) =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 40, completion_tokens: 30, total_tokens: 70 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeCompletion(reality))
        .mockResolvedValueOnce(makeCompletion(audit)),
    );

    const analyzeRes = await request("/api/profile/skills/analyze", token, {
      method: "POST",
    });
    expect(analyzeRes.status).toBe(202);

    await runQueuedAiJob({ kind: "skills", userId: "profile-user-evidence" });

    const profileRes = await request("/api/profile", token);
    const profile = (await profileRes.json()) as {
      skillInsights: {
        strengths: { evidenceLogs: { id: string; title: string }[] }[];
      };
    };

    expect(profile.skillInsights.strengths[0].evidenceLogs).toEqual([
      { id: knownId, title: "Shipped auth" },
    ]);
  });

  it("parses legacy skill insights without evidenceLogs as an empty list", async () => {
    const token = await createUser("profile-user-legacy");

    const legacyInsights = {
      archetype: "Legacy Engineer",
      summary: "Older insight set.",
      strengths: [
        {
          area: "Backend",
          description: "Built APIs.",
          evidenceSummary: "Shipped APIs.",
        },
      ],
      growthAreas: [
        {
          id: "gap-1",
          area: "Observability",
          gap: "No tracing.",
          recommendation: "Add tracing.",
        },
      ],
      recommendedNextSteps: ["Log more"],
      analyzedAt: "2026-01-01T00:00:00.000Z",
    };

    await env.DB.prepare(
      "INSERT INTO user_profiles (user_id, skill_insights) VALUES (?, ?)",
    )
      .bind("profile-user-legacy", JSON.stringify(legacyInsights))
      .run();

    const profileRes = await request("/api/profile", token);
    expect(profileRes.status).toBe(200);
    const profile = (await profileRes.json()) as {
      skillInsights: {
        strengths: { evidenceLogs: unknown[] }[];
      };
    };
    expect(profile.skillInsights.strengths[0].evidenceLogs).toEqual([]);
  });

  it("rejects a CV upload that is not a PDF, Markdown, or text file", async () => {
    const token = await createUser("profile-user-bad-cv");

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([137, 80, 78, 71])], "photo.png", {
        type: "image/png",
      }),
    );

    const res = await request("/api/profile/cv/upload", token, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("PDF, Markdown, or text");
  });

  it("marks an AI job failed and rejects so the queue can retry it", async () => {
    const token = await createUser("profile-user-job-fail");

    await request("/api/profile", token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cvMarkdown:
          "# Jane Doe - Senior Product Engineer\n\n- Built scalable React applications with TypeScript.",
      }),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("provider down")),
    );

    const batch = createMessageBatch<AiJobMessage>("pdevlog-ai-jobs", [
      {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        attempts: 1,
        body: { kind: "skills", userId: "profile-user-job-fail" },
      },
    ]);
    const ctx = createExecutionContext();

    await expect(app.queue(batch, env, ctx)).rejects.toThrow();

    const profileRes = await request("/api/profile", token);
    const profile = (await profileRes.json()) as { insightsStatus: string };
    expect(profile.insightsStatus).toBe("failed");
  });

  it("fails a job that has been stuck longer than the stale window", async () => {
    const token = await createUser("profile-user-stale");

    await request("/api/profile", token);
    await env.DB.prepare(
      "UPDATE user_profiles SET cv_parse_status = 'processing', ai_job_started_at = ? WHERE user_id = ?",
    )
      .bind(Date.now() - 200_000, "profile-user-stale")
      .run();

    const res = await request("/api/profile", token);
    const profile = (await res.json()) as { cvParseStatus: string };
    expect(profile.cvParseStatus).toBe("failed");
  });
});

