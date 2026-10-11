import { env } from "cloudflare:workers";
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
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return app.fetch(
    new Request(`https://example.com${path}`, { ...init, headers }),
    env,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("skills and radar isolation tests", () => {
  it("automatically seeds canonical skills and milestones on first access", async () => {
    const token = await createUser("skills-user-1");

    const res = await request("/api/skills", token);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      skills: { id: string; name: string; slug: string; milestones: unknown[] }[];
      radar: { axes: { name: string; score: number }[]; overallLevel: number };
    };

    expect(body.skills).toHaveLength(5);
    expect(body.skills.map((s) => s.slug)).toEqual([
      "ui-craft",
      "fullstack-data",
      "product-sense",
      "product-telemetry",
      "velocity-ai",
    ]);

    // Each skill should have 5 milestones (L1 to L5)
    for (const skill of body.skills) {
      expect(skill.milestones).toHaveLength(5);
    }

    expect(body.radar.axes).toHaveLength(5);
    expect(body.radar.overallLevel).toBe(0);
  });

  it("returns radar summary via /api/skills/radar", async () => {
    const token = await createUser("skills-user-2");

    const res = await request("/api/skills/radar", token);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      radar: { axes: { name: string }[]; totalAchievedMilestones: number };
    };

    expect(body.radar.axes).toHaveLength(5);
    expect(body.radar.totalAchievedMilestones).toBe(0);
  });

  it("allows attaching and unlinking evidence to update milestone achievement", async () => {
    const token = await createUser("skills-user-3");

    // Load skills to get a milestone ID
    const listRes = await request("/api/skills", token);
    const listBody = (await listRes.json()) as {
      skills: {
        id: string;
        slug: string;
        milestones: { id: string; level: number; status: string }[];
      }[];
    };

    const uiSkill = listBody.skills.find((s) => s.slug === "ui-craft");
    expect(uiSkill).toBeDefined();

    // Pick Level 3 (Optimistic UI & Resilient State)
    const l3Milestone = uiSkill!.milestones.find((m) => m.level === 3);
    expect(l3Milestone).toBeDefined();
    expect(l3Milestone!.status).toBe("locked");

    // Create a mock brag log in the DB
    const logId = "brag-log-proof-1";
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO brag_logs (id, user_id, title, situation, task, action, result, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        logId,
        "skills-user-3",
        "Sub-100ms Optimistic UI with Rollback",
        "Slow network latency",
        "Make app feel instantaneous",
        "Implemented optimistic mutations with rollback",
        "Zero perceived delay",
        "2026-10-10",
        now,
        now,
      )
      .run();

    // Attach evidence
    const attachRes = await request(
      `/api/skills/milestones/${l3Milestone!.id}/evidence`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          evidenceType: "brag_log",
          evidenceId: logId,
          reflection: "Proves optimistic UI craft and client resilience",
        }),
      },
    );
    expect(attachRes.status).toBe(201);
    const attachBody = (await attachRes.json()) as {
      evidence: { id: string; autoDetected: boolean };
    };
    expect(attachBody.evidence.id).toBeDefined();

    // Verify radar and milestone updated
    const updatedRes = await request("/api/skills", token);
    const updatedBody = (await updatedRes.json()) as {
      skills: {
        slug: string;
        score: number;
        milestones: { id: string; status: string; evidences: unknown[] }[];
      }[];
      radar: { totalAchievedMilestones: number };
    };

    const updatedUiSkill = updatedBody.skills.find(
      (s) => s.slug === "ui-craft",
    );
    const updatedL3 = updatedUiSkill!.milestones.find(
      (m) => m.id === l3Milestone!.id,
    );
    expect(updatedL3!.status).toBe("achieved");
    expect(updatedL3!.evidences).toHaveLength(1);
    expect(updatedUiSkill!.score).toBeGreaterThanOrEqual(3.0);
    expect(updatedBody.radar.totalAchievedMilestones).toBe(1);

    // Unlink evidence
    const unlinkRes = await request(
      `/api/skills/evidence/${attachBody.evidence.id}`,
      token,
      { method: "DELETE" },
    );
    expect(unlinkRes.status).toBe(200);

    // Verify milestone reverts to locked
    const afterUnlinkRes = await request("/api/skills", token);
    const afterUnlinkBody = (await afterUnlinkRes.json()) as {
      skills: {
        slug: string;
        score: number;
        milestones: { id: string; status: string }[];
      }[];
    };
    const afterSkill = afterUnlinkBody.skills.find(
      (s) => s.slug === "ui-craft",
    );
    const afterL3 = afterSkill!.milestones.find((m) => m.id === l3Milestone!.id);
    expect(afterL3!.status).toBe("locked");

  });
});

