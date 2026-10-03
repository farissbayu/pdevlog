import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  StarBreakdownError,
  generateStarBreakdown,
} from "@/worker/lib/openrouter";

function completionWith(content: string, status = 200): Response {
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
    { status, headers: { "content-type": "application/json" } },
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateStarBreakdown", () => {
  it("parses and validates a JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completionWith(STAR_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const { breakdown, usage } = await generateStarBreakdown(
      env,
      "spent the week fixing flaky checkout retries",
    );

    expect(breakdown.title).toBe("Recovered failed checkout payments");
    expect(breakdown.action).toContain("idempotency keys");
    expect(usage).toEqual({
      model: "test/openrouter-model",
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(String(url)).toContain("/chat/completions");
  });

  it("requests a json_schema response format with a tag enum", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      completionWith(
        JSON.stringify({
          title: "Title",
          situation: "Situation",
          task: "Task",
          action: "Action",
          result: "Result",
          tag_ids: ["tag-1"],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { breakdown } = await generateStarBreakdown(
      env,
      "fixed checkout retries",
      [{ id: "tag-1", name: "Payments" }],
    );

    expect(breakdown.tag_ids).toEqual(["tag-1"]);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      response_format: {
        type: string;
        json_schema: {
          name: string;
          strict: boolean;
          schema: {
            properties: {
              tag_ids: { items: { enum: string[] } };
              title: { description?: string };
            };
          };
        };
      };
    };
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("star_breakdown");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(
      body.response_format.json_schema.schema.properties.tag_ids.items.enum,
    ).toEqual(["tag-1"]);
    expect(
      body.response_format.json_schema.schema.properties.title.description,
    ).toContain("headline");
  });

  it("throws when the model returns a tag outside the enum", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        completionWith(
          JSON.stringify({
            title: "Title",
            situation: "Situation",
            task: "Task",
            action: "Action",
            result: "Result",
            tag_ids: ["tag-unknown"],
          }),
        ),
      ),
    );

    await expect(
      generateStarBreakdown(env, "fixed checkout retries", [
        { id: "tag-1", name: "Payments" },
      ]),
    ).rejects.toBeInstanceOf(StarBreakdownError);
  });

  it("throws when the response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(completionWith("sorry, I cannot help")),
    );

    await expect(
      generateStarBreakdown(env, "fixed checkout retries"),
    ).rejects.toBeInstanceOf(StarBreakdownError);
  });

  it("throws when STAR fields are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          completionWith(JSON.stringify({ title: "Only a title" })),
        ),
    );

    await expect(
      generateStarBreakdown(env, "fixed checkout retries"),
    ).rejects.toBeInstanceOf(StarBreakdownError);
  });

  it("throws when the upstream request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 })),
    );

    await expect(
      generateStarBreakdown(env, "fixed checkout retries"),
    ).rejects.toBeInstanceOf(StarBreakdownError);
  });
});
