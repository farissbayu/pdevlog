import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";
import type { AdminUserListResponse } from "@/shared/schemas/admin";

const ADMIN_EMAIL = "admin@example.com";

async function createUser(
  id: string,
  email = `${id}@example.com`,
): Promise<string> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, google_sub, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, `google-sub-${id}`, email, `User ${id}`, now, now)
    .run();

  return createSessionToken(id, env.JWT_SECRET);
}

async function createAdmin(id = "admin"): Promise<string> {
  return createUser(id, ADMIN_EMAIL);
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

async function createWorkspace(token: string, name: string): Promise<string> {
  const response = await request("/api/workspaces", token, {
    method: "POST",
    body: JSON.stringify({ name, type: "work" }),
  });
  const body = (await response.json()) as { workspace: { id: string } };
  return body.workspace.id;
}

async function seedUsage(id: string): Promise<string> {
  const token = await createUser(id);
  const workspaceId = await createWorkspace(token, `${id} workspace`);
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO ai_usage (id, user_id, model, prompt_tokens, completion_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(`usage-${id}`, id, "test/model", 10, 5, 15, now)
    .run();
  return workspaceId;
}

async function countRows(sql: string, ...params: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql)
    .bind(...params)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

describe("admin API", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await request("/api/admin/users", null);
    expect(response.status).toBe(401);
  });

  it("forbids non-admin users", async () => {
    const token = await createUser("member-perm");

    const users = await request("/api/admin/users", token);
    expect(users.status).toBe(403);

    const deletion = await request("/api/admin/users/member-perm", token, {
      method: "DELETE",
    });
    expect(deletion.status).toBe(403);
  });

  it("lists users with usage for admins", async () => {
    const adminToken = await createAdmin("admin-list");
    await seedUsage("member-usage");

    const response = await request("/api/admin/users", adminToken);
    expect(response.status).toBe(200);

    const body = (await response.json()) as AdminUserListResponse;
    const member = body.users.find((user) => user.id === "member-usage");
    expect(member).toBeDefined();
    expect(member?.usage.workspaces).toBe(1);
    expect(member?.usage.aiCalls).toBe(1);
    expect(member?.usage.aiTokens).toBe(15);

    const admin = body.users.find((user) => user.id === "admin-list");
    expect(admin?.isAdmin).toBe(true);
    expect(member?.isAdmin).toBe(false);
  });

  it("searches users by name or email", async () => {
    const adminToken = await createAdmin("admin-search");
    await createUser("searchable");

    const response = await request(
      "/api/admin/users?q=searchable",
      adminToken,
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as AdminUserListResponse;
    expect(body.users).toHaveLength(1);
    expect(body.users[0]?.id).toBe("searchable");
  });

  it("paginates users on the server", async () => {
    const adminToken = await createAdmin("admin-pager");
    await createUser("pager-a");
    await createUser("pager-b");
    await createUser("pager-c");

    const first = await request(
      "/api/admin/users?q=pager-&page=1&page_size=2",
      adminToken,
    );
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as AdminUserListResponse;
    expect(firstBody.users).toHaveLength(2);
    expect(firstBody.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    const firstIds = firstBody.users.map((user) => user.id);

    const second = await request(
      "/api/admin/users?q=pager-&page=2&page_size=2",
      adminToken,
    );
    const secondBody = (await second.json()) as AdminUserListResponse;
    expect(secondBody.users).toHaveLength(1);
    expect(secondBody.pagination.page).toBe(2);

    const combined = [...firstIds, ...secondBody.users.map((user) => user.id)];
    expect(new Set(combined).size).toBe(3);
  });

  it("prevents an admin from deleting their own account", async () => {
    const adminToken = await createAdmin("admin-self");

    const response = await request("/api/admin/users/admin-self", adminToken, {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM users WHERE id = ?",
        "admin-self",
      ),
    ).toBe(1);
  });

  it("hard deletes another user and all of their data", async () => {
    const adminToken = await createAdmin("admin-del");
    const workspaceId = await seedUsage("victim");

    const response = await request("/api/admin/users/victim", adminToken, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect((await response.json()) as { success: boolean }).toEqual({
      success: true,
    });

    expect(
      await countRows("SELECT COUNT(*) AS count FROM users WHERE id = ?", "victim"),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM workspaces WHERE user_id = ?",
        "victim",
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM ai_usage WHERE user_id = ?",
        "victim",
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM workspaces WHERE id = ?",
        workspaceId,
      ),
    ).toBe(0);

    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM users WHERE id = ?",
        "admin-del",
      ),
    ).toBe(1);
  });

  it("returns 404 when deleting an unknown user", async () => {
    const adminToken = await createAdmin("admin-unknown");

    const response = await request("/api/admin/users/ghost", adminToken, {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
  });
});
