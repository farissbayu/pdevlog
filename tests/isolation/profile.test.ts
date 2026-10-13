import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  const ctx = createExecutionContext();
  const response = await app.fetch(
    new Request(`https://example.com${path}`, { ...init, headers }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
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

    // Verify it is persisted in profile after the background job completes
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

    const mockAiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              archetype: "Product-Centric Fullstack Engineer",
              summary:
                "Strong fullstack engineer with proven execution across user-facing frontend and backend services.",
              strengths: [
                {
                  area: "Frontend Architecture & UI Craft",
                  description:
                    "High velocity building interactive apps with React and TypeScript.",
                  evidenceSummary:
                    "Built scalable React applications with TypeScript.",
                },
                {
                  area: "Relational Database Design",
                  description:
                    "Pragmatic modeling and migrations using SQLite and Postgres.",
                  evidenceSummary:
                    "Designed database schemas in SQLite and Postgres.",
                },
              ],
              growthAreas: [
                {
                  area: "Distributed Systems & Scalability",
                  gap: "Limited evidence of message brokers or distributed caching.",
                  recommendation:
                    "Build or document an event-driven queue project.",
                },
              ],
              recommendedNextSteps: [
                "Log architectural decisions around high-concurrency systems.",
              ],
              analyzedAt: new Date().toISOString(),
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 90,
        total_tokens: 210,
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockAiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const analyzeRes = await request("/api/profile/skills/analyze", token, {
      method: "POST",
    });

    expect(analyzeRes.status).toBe(202);
    const analyzeData = (await analyzeRes.json()) as { status: string };
    expect(analyzeData.status).toBe("analyzing");

    // Verify GET /api/profile returns the saved skillInsights after the job
    const profileRes = await request("/api/profile", token);
    const profileData = (await profileRes.json()) as {
      headline: string;
      skillInsights: {
        archetype: string;
        strengths: { area: string }[];
      };
      skillAnalyzedAt: string | null;
      insightsStatus: string;
    };

    expect(profileData.headline).toBe("Product-Centric Fullstack Engineer");
    expect(profileData.skillInsights.archetype).toBe(
      "Product-Centric Fullstack Engineer",
    );
    expect(profileData.skillInsights.strengths).toHaveLength(2);
    expect(profileData.skillAnalyzedAt).not.toBeNull();
    expect(profileData.insightsStatus).toBe("ready");
  });
});

