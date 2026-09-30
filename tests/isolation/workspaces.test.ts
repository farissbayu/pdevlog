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

type WorkspaceBody = {
  workspace: { id: string; name: string; type: string };
};

type ListBody = {
  workspaces: { id: string; name: string }[];
};

describe("workspace data isolation", () => {
  it("blocks cross-user read, update and delete with 404", async () => {
    const tokenA = await createUser("user-a");
    const tokenB = await createUser("user-b");

    const createResponse = await request("/api/workspaces", tokenA, {
      method: "POST",
      body: JSON.stringify({ name: "Owned by A", type: "work" }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as WorkspaceBody;
    const workspaceId = created.workspace.id;

    const ownRead = await request(`/api/workspaces/${workspaceId}`, tokenA);
    expect(ownRead.status).toBe(200);

    const crossRead = await request(`/api/workspaces/${workspaceId}`, tokenB);
    expect(crossRead.status).toBe(404);

    const crossUpdate = await request(
      `/api/workspaces/${workspaceId}`,
      tokenB,
      {
        method: "PUT",
        body: JSON.stringify({ name: "Hijacked" }),
      },
    );
    expect(crossUpdate.status).toBe(404);

    const crossDelete = await request(
      `/api/workspaces/${workspaceId}`,
      tokenB,
      { method: "DELETE" },
    );
    expect(crossDelete.status).toBe(404);

    const listA = (await (
      await request("/api/workspaces", tokenA)
    ).json()) as ListBody;
    expect(listA.workspaces).toHaveLength(1);

    const listB = (await (
      await request("/api/workspaces", tokenB)
    ).json()) as ListBody;
    expect(listB.workspaces).toHaveLength(0);
  });

  it("rejects unauthenticated access to workspaces", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/workspaces"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
