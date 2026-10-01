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

async function countRows(sql: string, ...params: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql)
    .bind(...params)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

async function createWorkspace(token: string, name: string): Promise<string> {
  const response = await request("/api/workspaces", token, {
    method: "POST",
    body: JSON.stringify({ name, type: "work" }),
  });
  const body = (await response.json()) as { workspace: { id: string } };
  return body.workspace.id;
}

async function createTag(token: string, name: string): Promise<string> {
  const response = await request("/api/tags", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const body = (await response.json()) as { tag: { id: string } };
  return body.tag.id;
}

async function createBragLog(
  token: string,
  workspaceId: string,
  tagId: string,
): Promise<string> {
  const response = await request("/api/brag-logs", token, {
    method: "POST",
    body: JSON.stringify({
      title: "Shipped a thing",
      situation: "s",
      task: "t",
      action: "a",
      result: "r",
      occurred_at: "2026-02-01",
      workspace_id: workspaceId,
      tag_ids: [tagId],
    }),
  });
  const body = (await response.json()) as { bragLog: { id: string } };
  return body.bragLog.id;
}

async function createLearningNote(
  token: string,
  workspaceId: string,
  tagId: string,
): Promise<string> {
  const response = await request("/api/learning-notes", token, {
    method: "POST",
    body: JSON.stringify({
      title: "Learned a thing",
      content: "## Notes\n\nDetails.",
      workspace_id: workspaceId,
      tag_ids: [tagId],
    }),
  });
  const body = (await response.json()) as { learningNote: { id: string } };
  return body.learningNote.id;
}

async function seedUser(
  id: string,
): Promise<{
  token: string;
  workspaceId: string;
  tagId: string;
  bragLogId: string;
  noteId: string;
}> {
  const token = await createUser(id);
  const workspaceId = await createWorkspace(token, `${id} workspace`);
  const tagId = await createTag(token, `${id} tag`);
  const bragLogId = await createBragLog(token, workspaceId, tagId);
  const noteId = await createLearningNote(token, workspaceId, tagId);
  return { token, workspaceId, tagId, bragLogId, noteId };
}

describe("account deletion cascade", () => {
  it("removes the user and all owned data while keeping other users intact", async () => {
    const userA = await seedUser("delete-a");
    const userB = await seedUser("delete-b");

    const response = await request("/api/auth/account", userA.token, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect((await response.json()) as { success: boolean }).toEqual({
      success: true,
    });
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE}=`,
    );

    expect(await countRows("SELECT COUNT(*) AS count FROM users WHERE id = ?", "delete-a")).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM workspaces WHERE user_id = ?",
        "delete-a",
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM tags WHERE user_id = ?",
        "delete-a",
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_logs WHERE user_id = ?",
        "delete-a",
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM learning_notes WHERE user_id = ?",
        "delete-a",
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_tags WHERE brag_log_id = ?",
        userA.bragLogId,
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM note_tags WHERE learning_note_id = ?",
        userA.noteId,
      ),
    ).toBe(0);

    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM workspaces WHERE user_id = ?",
        "delete-b",
      ),
    ).toBe(1);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM tags WHERE user_id = ?",
        "delete-b",
      ),
    ).toBe(1);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_logs WHERE user_id = ?",
        "delete-b",
      ),
    ).toBe(1);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM learning_notes WHERE user_id = ?",
        "delete-b",
      ),
    ).toBe(1);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_tags WHERE brag_log_id = ?",
        userB.bragLogId,
      ),
    ).toBe(1);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM note_tags WHERE learning_note_id = ?",
        userB.noteId,
      ),
    ).toBe(1);
  });

  it("revokes access for the deleted session", async () => {
    const userA = await seedUser("delete-session-a");

    const removed = await request("/api/auth/account", userA.token, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);

    const me = await request("/api/auth/me", userA.token);
    expect(me.status).toBe(401);
  });

  it("rejects unauthenticated account deletion", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/auth/account", {
        method: "DELETE",
      }),
      env,
    );

    expect(response.status).toBe(401);
  });
});
