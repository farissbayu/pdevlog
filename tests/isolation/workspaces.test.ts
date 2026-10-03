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

  it("creates, updates and exposes workspace sources", async () => {
    const token = await createUser("ws-source-owner");

    const created = await request("/api/workspaces", token, {
      method: "POST",
      body: JSON.stringify({
        name: "Bootcamp",
        type: "learning",
        sources: [
          {
            url: "https://coursera.org/learn/x",
            label: "Course",
            kind: "course",
          },
        ],
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      workspace: {
        id: string;
        sources: { id: string; url: string | null; kind: string | null }[];
      };
    };
    expect(body.workspace.sources).toHaveLength(1);
    expect(body.workspace.sources[0]?.kind).toBe("course");

    const workspaceId = body.workspace.id;

    const updated = await request(`/api/workspaces/${workspaceId}`, token, {
      method: "PUT",
      body: JSON.stringify({
        sources: [{ label: "Clean Code", kind: "book", locator: "p.1" }],
      }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as {
      workspace: {
        sources: {
          url: string | null;
          label: string | null;
          locator: string | null;
        }[];
      };
    };
    expect(updatedBody.workspace.sources).toHaveLength(1);
    expect(updatedBody.workspace.sources[0]?.url).toBeNull();
    expect(updatedBody.workspace.sources[0]?.label).toBe("Clean Code");
    expect(updatedBody.workspace.sources[0]?.locator).toBe("p.1");

    const detail = (await (
      await request(`/api/workspaces/${workspaceId}`, token)
    ).json()) as { workspace: { sources: unknown[] } };
    expect(detail.workspace.sources).toHaveLength(1);

    const list = (await (await request("/api/workspaces", token)).json()) as {
      workspaces: { sources: unknown[] }[];
    };
    expect(list.workspaces[0]?.sources).toHaveLength(1);
  });

  it("rejects a workspace source with neither URL nor label", async () => {
    const token = await createUser("ws-source-invalid");

    const response = await request("/api/workspaces", token, {
      method: "POST",
      body: JSON.stringify({
        name: "Bad source",
        type: "general",
        sources: [{ kind: "book" }],
      }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects unauthenticated access to workspaces", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/workspaces"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
