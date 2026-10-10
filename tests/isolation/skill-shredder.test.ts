import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

const BLUEPRINT = {
  topicTitle: "WebSockets",
  toyProjectTitle: "2-client terminal walkie-talkie",
  toyProjectPitch: "Two terminal clients exchange messages live.",
  fundamentalPillars: [
    { name: "Handshake", explanation: "The upgrade from HTTP to a socket." },
    { name: "Duplex", explanation: "Both sides push messages at any time." },
  ],
  spike0: {
    title: "Echo server",
    objective: "Prove a Worker can hold a WebSocket open.",
    scratchSnippet: "export default { fetch() { return new Response('pong'); } }",
    successCriteria: "Terminal prints the echoed message.",
    estimatedMinutes: 15,
  },
  milestones: [
    {
      stepNumber: 1,
      title: "Scaffold an echo server",
      actionDescription: "Create a single WebSocket route.",
      verificationGuide: "wscat connects without error.",
      estimatedMinutes: 30,
    },
    {
      stepNumber: 2,
      title: "Broadcast to all clients",
      actionDescription: "Fan out messages to every socket.",
      verificationGuide: "Two clients see each other's messages.",
      estimatedMinutes: 45,
    },
  ],
  ignoreList: ["No database", "No auth", "No styling"],
  practiceChallenge: {
    challenge: "Handle client disconnect without crashing the server.",
    hint: "Think about the close event and your socket set.",
  },
};

function completionWith(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1_700_000_000,
      model: "test/ai-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

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

type ShredBody = {
  shred: {
    id: string;
    topic: string;
    toyProjectTitle: string;
    status: string;
    completedSteps: string[];
    noteId: string | null;
    blueprint: { milestones: { stepNumber: number }[] };
  };
};

async function createShred(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: ShredBody }> {
  const response = await request("/api/skill-shredder", token, {
    method: "POST",
    body: JSON.stringify({
      topic: "WebSockets in Cloudflare Workers",
      currentContext: "I know REST fetch",
      targetTimeMinutes: 60,
      blueprint: BLUEPRINT,
      ...overrides,
    }),
  });
  return { status: response.status, body: (await response.json()) as ShredBody };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("skill shredder", () => {
  it("generates a blueprint from the AI provider", async () => {
    const token = await createUser("skill-generate");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(completionWith(JSON.stringify(BLUEPRINT))),
    );

    const response = await request("/api/skill-shredder/generate", token, {
      method: "POST",
      body: JSON.stringify({
        topic: "WebSockets in Cloudflare Workers",
        targetTimeMinutes: 60,
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      blueprint: { toyProjectTitle: string };
    };
    expect(body.blueprint.toyProjectTitle).toBe(
      "2-client terminal walkie-talkie",
    );
  });

  it("persists, lists and deletes a shred for the owner", async () => {
    const token = await createUser("skill-owner");

    const created = await createShred(token);
    expect(created.status).toBe(201);
    expect(created.body.shred.status).toBe("draft");
    expect(created.body.shred.toyProjectTitle).toContain("walkie-talkie");

    const list = (await (
      await request("/api/skill-shredder", token)
    ).json()) as { shreds: { id: string }[] };
    expect(list.shreds).toHaveLength(1);

    const deleted = await request(
      `/api/skill-shredder/${created.body.shred.id}`,
      token,
      { method: "DELETE" },
    );
    expect(deleted.status).toBe(200);

    const after = (await (
      await request("/api/skill-shredder", token)
    ).json()) as { shreds: unknown[] };
    expect(after.shreds).toHaveLength(0);
  });

  it("derives status as steps and milestones are completed", async () => {
    const token = await createUser("skill-progress");
    const created = await createShred(token);
    const id = created.body.shred.id;

    const spike = await request(`/api/skill-shredder/${id}/progress`, token, {
      method: "PATCH",
      body: JSON.stringify({ completedSteps: ["spike"] }),
    });
    expect(((await spike.json()) as ShredBody).shred.status).toBe("spike_done");

    const building = await request(
      `/api/skill-shredder/${id}/progress`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({ completedSteps: ["spike", "step-1"] }),
      },
    );
    expect(((await building.json()) as ShredBody).shred.status).toBe("building");

    const done = await request(`/api/skill-shredder/${id}/progress`, token, {
      method: "PATCH",
      body: JSON.stringify({
        completedSteps: ["spike", "step-1", "step-2", "challenge"],
      }),
    });
    const doneBody = (await done.json()) as ShredBody;
    expect(doneBody.shred.status).toBe("completed");
    expect(doneBody.shred.completedSteps).toContain("challenge");
  });

  it("exports a shred to a TIL note", async () => {
    const token = await createUser("skill-export");
    const created = await createShred(token);
    const id = created.body.shred.id;

    const exported = await request(`/api/skill-shredder/${id}/note`, token, {
      method: "POST",
    });
    expect(exported.status).toBe(201);
    const exportBody = (await exported.json()) as {
      noteId: string;
      shred: { noteId: string };
    };
    expect(exportBody.shred.noteId).toBe(exportBody.noteId);

    const note = await request(`/api/notes/${exportBody.noteId}`, token);
    expect(note.status).toBe(200);
    const noteBody = (await note.json()) as {
      note: { title: string; content: string };
    };
    expect(noteBody.note.title).toContain("WebSockets");
    expect(noteBody.note.content).toContain("Fundamental Pillars");
    expect(noteBody.note.content).toContain("Deliberate Practice Challenge");
  });

  it("blocks cross-user access with 404", async () => {
    const tokenA = await createUser("skill-user-a");
    const tokenB = await createUser("skill-user-b");

    const created = await createShred(tokenA);
    const id = created.body.shred.id;

    expect((await request(`/api/skill-shredder/${id}`, tokenB)).status).toBe(404);
    expect(
      (
        await request(`/api/skill-shredder/${id}/progress`, tokenB, {
          method: "PATCH",
          body: JSON.stringify({ completedSteps: ["spike"] }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(`/api/skill-shredder/${id}/note`, tokenB, {
          method: "POST",
        })
      ).status,
    ).toBe(404);
    expect(
      (await request(`/api/skill-shredder/${id}`, tokenB, { method: "DELETE" }))
        .status,
    ).toBe(404);

    const listB = (await (
      await request("/api/skill-shredder", tokenB)
    ).json()) as { shreds: unknown[] };
    expect(listB.shreds).toHaveLength(0);
  });

  it("rejects unauthenticated access", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/skill-shredder"),
      env,
    );
    expect(response.status).toBe(401);
  });
});
