import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SkillShredderError,
  generateSkillShredder,
} from "@/worker/lib/ai-client";
import { noteToShredContext } from "@/shared/schemas/skill-shredder";

function completionWith(content: string, status = 200): Response {
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
      usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

const BLUEPRINT_JSON = JSON.stringify({
  topicTitle: "WebSockets",
  toyProjectTitle: "2-client terminal walkie-talkie",
  toyProjectPitch:
    "Two terminal clients exchange messages live, proving handshakes, duplex messaging and reconnection.",
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
      actionDescription: "Keep a set of sockets and fan out messages.",
      verificationGuide: "Two wscat clients see each other's messages.",
      estimatedMinutes: 45,
    },
  ],
  ignoreList: ["No database", "No auth", "No styling"],
  practiceChallenge: {
    challenge: "Handle client disconnect without crashing the server.",
    hint: "Think about the close event and your socket set.",
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateSkillShredder", () => {
  it("parses and validates a blueprint response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completionWith(BLUEPRINT_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const { blueprint, usage } = await generateSkillShredder(
      env,
      "WebSockets in Cloudflare Workers",
      "I know REST fetch",
      60,
    );

    expect(blueprint.toyProjectTitle).toBe("2-client terminal walkie-talkie");
    expect(blueprint.milestones).toHaveLength(2);
    expect(blueprint.ignoreList).toContain("No auth");
    expect(blueprint.practiceChallenge.challenge).toContain("disconnect");
    expect(usage).toEqual({
      model: "test/ai-model",
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      response_format: { json_schema: { name: string; strict: boolean } };
    };
    expect(body.response_format.json_schema.name).toBe("skill_shredder");
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it("throws when the blueprint is missing fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(completionWith(JSON.stringify({ topicTitle: "x" }))),
    );

    await expect(
      generateSkillShredder(env, "WebSockets in Cloudflare Workers", undefined),
    ).rejects.toBeInstanceOf(SkillShredderError);
  });

  it("throws when the upstream request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 })),
    );

    await expect(
      generateSkillShredder(env, "WebSockets in Cloudflare Workers", undefined),
    ).rejects.toBeInstanceOf(SkillShredderError);
  });

  it("passes note context into the user prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completionWith(BLUEPRINT_JSON));
    vi.stubGlobal("fetch", fetchMock);

    await generateSkillShredder(
      env,
      "Raft consensus",
      "Raft is a leader-based consensus algorithm.",
      60,
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      messages: { role: string; content: string }[];
    };
    const user = body.messages.find((message) => message.role === "user");
    expect(user?.content).toContain("Reference material");
    expect(user?.content).toContain("Raft is a leader-based consensus algorithm.");
  });

  it("sends gateway identity headers from the environment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completionWith(BLUEPRINT_JSON));
    vi.stubGlobal("fetch", fetchMock);

    await generateSkillShredder(
      env,
      "WebSockets in Cloudflare Workers",
      undefined,
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("HTTP-Referer")).toBe(env.APP_URL);
    expect(headers.get("X-Title")).toBe(env.APP_NAME);
  });

  it("falls back to safe gateway headers when the environment omits them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completionWith(BLUEPRINT_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const envWithoutApp = {
      ...env,
      APP_URL: undefined,
      APP_NAME: undefined,
    } as unknown as typeof env;

    await generateSkillShredder(
      envWithoutApp,
      "WebSockets in Cloudflare Workers",
      undefined,
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("HTTP-Referer")).toBe("https://pdevlog.pages.dev");
    expect(headers.get("X-Title")).toBe("pdevlog");
  });
});

describe("noteToShredContext", () => {
  it("strips markdown and caps the length", () => {
    const markdown = [
      "# Raft Consensus",
      "",
      "![diagram](https://example.com/d.png)",
      "",
      "Use `AppendEntries` and a [leader](https://example.com/leader).",
      "",
      "```ts",
      "const term = 1;",
      "```",
      "",
      "a".repeat(800),
    ].join("\n");

    const context = noteToShredContext(markdown, 500);

    expect(context).toContain("Raft Consensus");
    expect(context).toContain("AppendEntries");
    expect(context).not.toContain("#");
    expect(context).not.toContain("```");
    expect(context).not.toContain("](http");
    expect(context.length).toBeLessThanOrEqual(500);
  });
});
