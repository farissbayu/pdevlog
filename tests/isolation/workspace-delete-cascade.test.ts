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

async function createNote(
  token: string,
  workspaceId: string,
  tagId: string,
): Promise<string> {
  const response = await request("/api/notes", token, {
    method: "POST",
    body: JSON.stringify({
      title: "Learned a thing",
      content: "## Notes\n\nDetails.",
      workspace_id: workspaceId,
      tag_ids: [tagId],
      sources: [{ url: "https://example.com/note-source" }],
    }),
  });
  const body = (await response.json()) as { note: { id: string } };
  return body.note.id;
}

describe("workspace deletion cascade", () => {
  it("removes the workspace's brag logs and notes but keeps tags", async () => {
    const token = await createUser("ws-cascade");
    const workspaceId = await createWorkspace(token, "work");
    const otherWorkspaceId = await createWorkspace(token, "other");
    const tagId = await createTag(token, "shared");

    const bragLogId = await createBragLog(token, workspaceId, tagId);
    const noteId = await createNote(token, workspaceId, tagId);
    const otherBragLogId = await createBragLog(
      token,
      otherWorkspaceId,
      tagId,
    );

    await request(`/api/workspaces/${workspaceId}`, token, {
      method: "PUT",
      body: JSON.stringify({
        sources: [{ url: "https://example.com/workspace-source" }],
      }),
    });

    const response = await request(`/api/workspaces/${workspaceId}`, token, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect((await response.json()) as { success: boolean }).toEqual({
      success: true,
    });

    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_logs WHERE workspace_id = ?",
        workspaceId,
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM notes WHERE workspace_id = ?",
        workspaceId,
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_tags WHERE brag_log_id = ?",
        bragLogId,
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM note_tags WHERE note_id = ?",
        noteId,
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM sources WHERE owner_type = 'workspace' AND owner_id = ?",
        workspaceId,
      ),
    ).toBe(0);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM sources WHERE owner_type = 'note' AND owner_id = ?",
        noteId,
      ),
    ).toBe(0);

    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_logs WHERE workspace_id = ?",
        otherWorkspaceId,
      ),
    ).toBe(1);
    expect(
      await countRows(
        "SELECT COUNT(*) AS count FROM brag_tags WHERE brag_log_id = ?",
        otherBragLogId,
      ),
    ).toBe(1);
    expect(
      await countRows("SELECT COUNT(*) AS count FROM tags WHERE id = ?", tagId),
    ).toBe(1);
  });
});
