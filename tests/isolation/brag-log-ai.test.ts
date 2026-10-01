import { env } from "cloudflare:test";
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
  token: string | null,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Cookie", `${SESSION_COOKIE}=${token}`);
  }
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return app.fetch(
    new Request(`https://example.com${path}`, { ...init, headers }),
    env,
  );
}

function completionWith(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1_700_000_000,
      model: "test/openrouter-model",
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

const STAR_JSON = JSON.stringify({
  title: "Recovered failed checkout payments",
  situation: "Checkout retries failed intermittently and orders were lost.",
  task: "Make payment retries reliable without double charging.",
  action: "Reworked the retry logic behind idempotency keys.",
  result: "Recovered failed orders and reduced support tickets.",
  tag_ids: [],
});

const SOURCE_CONTENT =
  "spent the week fixing flaky checkout retries that were dropping payments";

async function createTag(token: string, name: string): Promise<string> {
  const response = await request("/api/tags", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const body = (await response.json()) as { tag: { id: string } };
  return body.tag.id;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("brag log AI star breakdown route", () => {
  it("returns the generated breakdown", async () => {
    const token = await createUser("ai-happy");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completionWith(STAR_JSON)));

    const response = await request("/api/brag-logs/star-breakdown", token, {
      method: "POST",
      body: JSON.stringify({ content: SOURCE_CONTENT }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      breakdown: Record<string, string>;
    };
    expect(body.breakdown.title).toBe("Recovered failed checkout payments");
    expect(body.breakdown.result).toContain("failed orders");
  });

  it("restricts tag suggestions to tags owned by the user", async () => {
    const token = await createUser("ai-tags");
    const ownedTag = await createTag(token, "Payments");
    const otherToken = await createUser("ai-tags-other");
    const otherTag = await createTag(otherToken, "Other user tag");

    const fetchMock = vi.fn().mockResolvedValue(
      completionWith(
        JSON.stringify({
          title: "Recovered failed checkout payments",
          situation: "Checkout retries failed intermittently.",
          task: "Make retries reliable.",
          action: "Added idempotency keys.",
          result: "Recovered failed orders.",
          tag_ids: [ownedTag],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await request("/api/brag-logs/star-breakdown", token, {
      method: "POST",
      body: JSON.stringify({ content: SOURCE_CONTENT }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      breakdown: { tag_ids: string[] };
    };
    expect(body.breakdown.tag_ids).toEqual([ownedTag]);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const sent = JSON.parse(String(init.body)) as {
      response_format: {
        json_schema: {
          schema: { properties: { tag_ids: { items: { enum: string[] } } } };
        };
      };
    };
    const allowed =
      sent.response_format.json_schema.schema.properties.tag_ids.items.enum;
    expect(allowed).toEqual([ownedTag]);
    expect(allowed).not.toContain(otherTag);
  });

  it("returns 502 when the AI response is unusable", async () => {
    const token = await createUser("ai-failure");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(completionWith("not valid json")),
    );

    const response = await request("/api/brag-logs/star-breakdown", token, {
      method: "POST",
      body: JSON.stringify({ content: SOURCE_CONTENT }),
    });

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/JSON/i);
  });

  it("rejects content that is too short with 400", async () => {
    const token = await createUser("ai-short");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await request("/api/brag-logs/star-breakdown", token, {
      method: "POST",
      body: JSON.stringify({ content: "too short" }),
    });

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const response = await request("/api/brag-logs/star-breakdown", null, {
      method: "POST",
      body: JSON.stringify({ content: SOURCE_CONTENT }),
    });

    expect(response.status).toBe(401);
  });
});
