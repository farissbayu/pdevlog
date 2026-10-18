import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

const DAY_MS = 86_400_000;

const SUGGESTION_JSON = JSON.stringify({
  title: "Connection pooling and prepared statement caching in D1",
  category: "Performance",
  reason:
    "Because you shipped the project items queue, the next natural concept is query batching in D1.",
  practicalNextStep:
    "Build a 1h spike that measures batched writes against sequential inserts.",
  suggestedOutline:
    "# Guiding questions\n\n- Where do repeated round trips hurt most?\n- What does plan caching buy us?",
  suggestedTags: ["d1", "caching"],
  usedSourceTitles: ["Recent note", "Invented topic"],
  sourceContextSummary: "Inspired by your work on Projects & Notes",
});

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

async function insertNote(
  userId: string,
  id: string,
  title: string,
  timestamp: number,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO notes (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, title, `${title} content`, timestamp, timestamp)
    .run();
}

async function insertBragLog(
  userId: string,
  id: string,
  title: string,
  timestamp: number,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO brag_logs (id, user_id, title, situation, task, action, result, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      userId,
      title,
      "Situation",
      "Task",
      `Worked on ${title}`,
      "Result",
      "2026-01-01",
      timestamp,
      timestamp,
    )
    .run();
}

type SuggestionBody = {
  suggestion: {
    id: string;
    title: string;
    status: string;
    regenerateCount: number;
    regenerationsLeft: number;
    suggestedTags: string[];
    sourceItems: { kind: string; title: string }[];
  } | null;
  hasRecentActivity: boolean;
  todayKey: string;
  regenerationsLeft: number;
};

const generate = (token: string) =>
  request("/api/dashboard/learning-suggestion/generate", token, {
    method: "POST",
    body: JSON.stringify({ tz_offset: 0 }),
  });

const regenerate = (token: string) =>
  request("/api/dashboard/learning-suggestion/regenerate", token, {
    method: "POST",
    body: JSON.stringify({ tz_offset: 0 }),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("daily learning suggestion", () => {
  it("generates once per day, then serves the stored suggestion", async () => {
    const token = await createUser("learn-owner");
    await insertNote("learn-owner", "learn-note-1", "SQLite notes", Date.now());
    const fetchMock = vi.fn().mockResolvedValue(completionWith(SUGGESTION_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const first = await generate(token);
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as SuggestionBody;
    expect(firstBody.suggestion?.title).toBe(
      "Connection pooling and prepared statement caching in D1",
    );
    expect(firstBody.suggestion?.regenerateCount).toBe(0);
    expect(firstBody.suggestion?.regenerationsLeft).toBe(3);
    expect(firstBody.suggestion?.suggestedTags).toEqual(["d1", "caching"]);
    expect(firstBody.suggestion?.sourceItems).toEqual([]);
    expect(firstBody.hasRecentActivity).toBe(true);
    expect(firstBody.todayKey).toBe(new Date().toISOString().slice(0, 10));

    const again = await generate(token);
    expect(again.status).toBe(200);
    const againBody = (await again.json()) as SuggestionBody;
    expect(againBody.suggestion?.id).toBe(firstBody.suggestion?.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const suggestionId = firstBody.suggestion?.id ?? "";
    const action = await request(
      `/api/dashboard/learning-suggestion/${suggestionId}/action`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ status: "saved_as_spark" }),
      },
    );
    expect(action.status).toBe(200);

    const get = await request(
      "/api/dashboard/learning-suggestion?tz_offset=0",
      token,
    );
    expect(get.status).toBe(200);
    const getBody = (await get.json()) as SuggestionBody;
    expect(getBody.suggestion?.id).toBe(suggestionId);
    expect(getBody.suggestion?.status).toBe("saved_as_spark");
  });

  it("allows three regenerations per day and rejects the fourth", async () => {
    const token = await createUser("learn-regen");
    await insertNote("learn-regen", "learn-regen-note", "D1 work", Date.now());
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(completionWith(SUGGESTION_JSON)));
    vi.stubGlobal("fetch", fetchMock);

    const created = await generate(token);
    expect(created.status).toBe(201);

    for (const expectedLeft of [2, 1, 0]) {
      const response = await regenerate(token);
      expect(response.status).toBe(200);
      const body = (await response.json()) as SuggestionBody;
      expect(body.regenerationsLeft).toBe(expectedLeft);
      expect(body.suggestion?.regenerateCount).toBe(3 - expectedLeft);
    }

    const firstRegenInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const firstRegenBody = JSON.parse(String(firstRegenInit.body)) as {
      messages: { role: string; content: string }[];
    };
    const firstRegenPrompt =
      firstRegenBody.messages.find((message) => message.role === "user")
        ?.content ?? "";
    expect(firstRegenPrompt).toContain("Do NOT repeat");
    expect(firstRegenPrompt).toContain(
      "Connection pooling and prepared statement caching in D1",
    );

    const blocked = await regenerate(token);
    expect(blocked.status).toBe(400);
    const blockedBody = (await blocked.json()) as { error: string };
    expect(blockedBody.error).toMatch(/limit/i);
  });

  it("isolates suggestions and actions between users", async () => {
    const tokenA = await createUser("learn-user-a");
    const tokenB = await createUser("learn-user-b");
    await insertNote("learn-user-a", "learn-a-note", "Worked on queues", Date.now());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completionWith(SUGGESTION_JSON)));

    const created = await generate(tokenA);
    const createdBody = (await created.json()) as SuggestionBody;
    const suggestionId = createdBody.suggestion?.id ?? "";
    expect(suggestionId).not.toBe("");

    const getB = await request(
      "/api/dashboard/learning-suggestion?tz_offset=0",
      tokenB,
    );
    const getBBody = (await getB.json()) as SuggestionBody;
    expect(getBBody.suggestion).toBeNull();
    expect(getBBody.hasRecentActivity).toBe(false);
    expect(getBBody.regenerationsLeft).toBe(3);

    const regenerateB = await regenerate(tokenB);
    expect(regenerateB.status).toBe(404);

    const actionB = await request(
      `/api/dashboard/learning-suggestion/${suggestionId}/action`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ status: "converted_to_note" }),
      },
    );
    expect(actionB.status).toBe(404);
  });

  it("only feeds the last 7 days of activity to the AI", async () => {
    const token = await createUser("learn-window");
    const now = Date.now();
    await insertNote("learn-window", "recent-note", "Recent note", now);
    await insertBragLog(
      "learn-window",
      "recent-log",
      "Recent brag log",
      now - DAY_MS,
    );
    await insertNote(
      "learn-window",
      "ancient-note",
      "Ancient note",
      now - 10 * DAY_MS,
    );

    const fetchMock = vi.fn().mockResolvedValue(completionWith(SUGGESTION_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const response = await generate(token);
    expect(response.status).toBe(201);
    const body = (await response.json()) as SuggestionBody;
    expect(body.suggestion?.sourceItems).toEqual([
      { kind: "note", title: "Recent note" },
    ]);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const sent = JSON.parse(String(init.body)) as {
      messages: { role: string; content: string }[];
    };
    const userMessage =
      sent.messages.find((message) => message.role === "user")?.content ?? "";
    expect(userMessage).toContain("Recent note");
    expect(userMessage).toContain("Recent brag log");
    expect(userMessage).not.toContain("Ancient note");
  });

  it("records an ai_usage row for each generation", async () => {
    const token = await createUser("learn-usage");
    await insertNote("learn-usage", "learn-usage-note", "Work", Date.now());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completionWith(SUGGESTION_JSON)));

    const response = await generate(token);
    expect(response.status).toBe(201);

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count, SUM(total_tokens) AS tokens FROM ai_usage WHERE user_id = ?",
    )
      .bind("learn-usage")
      .first<{ count: number; tokens: number }>();
    expect(row?.count).toBe(1);
    expect(row?.tokens).toBe(2);
  });

  it("requires authentication", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/dashboard/learning-suggestion"),
      env,
    );
    expect(response.status).toBe(401);
  });
});
