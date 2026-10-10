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

async function createWorkspace(token: string, name = "Side Hustles") {
  const response = await request("/api/workspaces", token, {
    method: "POST",
    body: JSON.stringify({ name, type: "general" }),
  });
  const body = (await response.json()) as { workspace: { id: string } };
  return body.workspace.id;
}

type ProjectBody = { project: { id: string; name: string } };
type ItemBody = {
  item: { id: string; status: string; shippedVersion: string | null };
};

async function createProject(token: string, workspaceId: string) {
  const response = await request("/api/projects", token, {
    method: "POST",
    body: JSON.stringify({ workspace_id: workspaceId, name: "pdevlog" }),
  });
  return { status: response.status, body: (await response.json()) as ProjectBody };
}

async function createItem(
  token: string,
  projectId: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await request(`/api/projects/${projectId}/items`, token, {
    method: "POST",
    body: JSON.stringify({ title: "Semantic search", ...overrides }),
  });
  return { status: response.status, body: (await response.json()) as ItemBody };
}

describe("project backlog and changelog", () => {
  it("creates a project in an owned workspace and lists it", async () => {
    const token = await createUser("proj-owner");
    const workspaceId = await createWorkspace(token);

    const created = await createProject(token, workspaceId);
    expect(created.status).toBe(201);
    expect(created.body.project.name).toBe("pdevlog");

    const list = (await (
      await request(`/api/projects?workspace_id=${workspaceId}`, token)
    ).json()) as { projects: { id: string }[] };
    expect(list.projects).toHaveLength(1);
  });

  it("rejects creating a project in another user's workspace", async () => {
    const tokenA = await createUser("proj-ws-a");
    const tokenB = await createUser("proj-ws-b");
    const workspaceId = await createWorkspace(tokenA);

    const attempt = await createProject(tokenB, workspaceId);
    expect(attempt.status).toBe(404);
  });

  it("ships a backlog item into the changelog", async () => {
    const token = await createUser("ship-user");
    const workspaceId = await createWorkspace(token);
    const project = await createProject(token, workspaceId);

    const item = await createItem(token, project.body.project.id, {
      kind: "feat",
      target_version: "v0.3.0",
    });
    expect(item.status).toBe(201);

    const backlog = (await (
      await request(`/api/projects/${project.body.project.id}/items?status=backlog`, token)
    ).json()) as { items: unknown[] };
    expect(backlog.items).toHaveLength(1);

    const shipped = await request(
      `/api/projects/${project.body.project.id}/items/${item.body.item.id}/ship`,
      token,
      { method: "POST", body: JSON.stringify({}) },
    );
    expect(shipped.status).toBe(200);
    const shippedBody = (await shipped.json()) as ItemBody;
    expect(shippedBody.item.status).toBe("shipped");
    expect(shippedBody.item.shippedVersion).toBe("v0.3.0");

    const changelog = await request(
      `/api/projects/${project.body.project.id}/items?status=shipped`,
      token,
    );
    const changelogBody = (await changelog.json()) as { items: unknown[] };
    expect(changelogBody.items).toHaveLength(1);

    const markdown = await request(
      `/api/projects/${project.body.project.id}/changelog/export`,
      token,
    );
    const text = await markdown.text();
    expect(text).toContain("# Changelog - pdevlog");
    expect(text).toContain("## v0.3.0");
    expect(text).toContain("### Added");
    expect(text).toContain("- Semantic search");
  });

  it("promotes a spark into a backlog item", async () => {
    const token = await createUser("proj-spark");
    const workspaceId = await createWorkspace(token);
    const project = await createProject(token, workspaceId);

    const sparkResponse = await request("/api/sparks", token, {
      method: "POST",
      body: JSON.stringify({ content: "Add vector search" }),
    });
    const spark = (await sparkResponse.json()) as { spark: { id: string } };

    const item = await createItem(token, project.body.project.id, {
      spark_id: spark.spark.id,
    });
    expect(item.status).toBe(201);

    const sparkDetail = (await (
      await request(`/api/sparks/${spark.spark.id}`, token)
    ).json()) as {
      spark: { status: string; promotedType: string; promotedId: string };
    };
    expect(sparkDetail.spark.status).toBe("promoted");
    expect(sparkDetail.spark.promotedType).toBe("project-item");
    expect(sparkDetail.spark.promotedId).toBe(item.body.item.id);
  });

  it("blocks cross-user access with 404", async () => {
    const tokenA = await createUser("proj-a");
    const tokenB = await createUser("proj-b");
    const workspaceId = await createWorkspace(tokenA);
    const project = await createProject(tokenA, workspaceId);
    const item = await createItem(tokenA, project.body.project.id);

    expect(
      (await request(`/api/projects/${project.body.project.id}`, tokenB)).status,
    ).toBe(404);
    expect(
      (
        await request(`/api/projects/${project.body.project.id}/items`, tokenB)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          `/api/projects/${project.body.project.id}/items/${item.body.item.id}`,
          tokenB,
          { method: "DELETE" },
        )
      ).status,
    ).toBe(404);
  });

  it("rejects unauthenticated access", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/projects"),
      env,
    );
    expect(response.status).toBe(401);
  });
});
