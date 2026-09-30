import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

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

type TagBody = {
  tag: { id: string; name: string };
};

async function createTag(
  token: string,
  name: string,
): Promise<{ status: number; body: TagBody }> {
  const response = await request("/api/tags", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return { status: response.status, body: (await response.json()) as TagBody };
}

describe("tag constraints and isolation", () => {
  it("rejects a duplicate tag name for the same user with 409", async () => {
    const tokenA = await createUser("dup-user");

    const first = await createTag(tokenA, "Docker");
    expect(first.status).toBe(201);

    const second = await createTag(tokenA, "Docker");
    expect(second.status).toBe(409);
  });

  it("allows different users to own a tag with the same name", async () => {
    const tokenA = await createUser("same-name-a");
    const tokenB = await createUser("same-name-b");

    const tagA = await createTag(tokenA, "Docker");
    const tagB = await createTag(tokenB, "Docker");

    expect(tagA.status).toBe(201);
    expect(tagB.status).toBe(201);
    expect(tagA.body.tag.id).not.toBe(tagB.body.tag.id);
  });

  it("blocks cross-user update and delete with 404", async () => {
    const tokenA = await createUser("owner-a");
    const tokenB = await createUser("intruder-b");

    const created = await createTag(tokenA, "Docker");
    const tagId = created.body.tag.id;

    const crossUpdate = await request(`/api/tags/${tagId}`, tokenB, {
      method: "PUT",
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(crossUpdate.status).toBe(404);

    const crossDelete = await request(`/api/tags/${tagId}`, tokenB, {
      method: "DELETE",
    });
    expect(crossDelete.status).toBe(404);

    const listA = (await (await request("/api/tags", tokenA)).json()) as {
      tags: { id: string; name: string }[];
    };
    expect(listA.tags).toEqual([
      expect.objectContaining({ id: tagId, name: "Docker" }),
    ]);

    const listB = (await (await request("/api/tags", tokenB)).json()) as {
      tags: unknown[];
    };
    expect(listB.tags).toHaveLength(0);
  });

  it("rejects unauthenticated access to tags", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/tags"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
