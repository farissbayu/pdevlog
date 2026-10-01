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

async function createWorkspace(token: string, name: string): Promise<string> {
  const response = await request("/api/workspaces", token, {
    method: "POST",
    body: JSON.stringify({ name, type: "learning" }),
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

type LearningNoteBody = {
  learningNote: {
    id: string;
    title: string;
    content: string;
    workspaceId: string | null;
    tags: { id: string; name: string }[];
  };
};

function notePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "D1 indexes deep dive",
    content: "# Indexes\n\nA composite index helps a lot.",
    ...overrides,
  };
}

async function createLearningNote(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: LearningNoteBody }> {
  const response = await request("/api/learning-notes", token, {
    method: "POST",
    body: JSON.stringify(notePayload(overrides)),
  });
  return {
    status: response.status,
    body: (await response.json()) as LearningNoteBody,
  };
}

describe("learning note isolation and relation ownership", () => {
  it("persists tags and workspace for the owner", async () => {
    const tokenA = await createUser("note-owner");
    const workspaceId = await createWorkspace(tokenA, "Databases");
    const sqlTag = await createTag(tokenA, "SQL");
    const cfTag = await createTag(tokenA, "Cloudflare");

    const created = await createLearningNote(tokenA, {
      workspace_id: workspaceId,
      tag_ids: [sqlTag, cfTag],
    });

    expect(created.status).toBe(201);
    expect(created.body.learningNote.workspaceId).toBe(workspaceId);
    expect(created.body.learningNote.content).toContain("# Indexes");
    expect(
      created.body.learningNote.tags.map((tag) => tag.id).sort(),
    ).toEqual([sqlTag, cfTag].sort());

    const detail = await request(
      `/api/learning-notes/${created.body.learningNote.id}`,
      tokenA,
    );
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as LearningNoteBody;
    expect(detailBody.learningNote.tags).toHaveLength(2);
    expect(detailBody.learningNote.workspaceId).toBe(workspaceId);

    const list = (await (
      await request("/api/learning-notes", tokenA)
    ).json()) as { learningNotes: unknown[] };
    expect(list.learningNotes).toHaveLength(1);
  });

  it("updates fields and syncs junction tags for the owner", async () => {
    const token = await createUser("note-updater");
    const sqlTag = await createTag(token, "SQL");
    const goTag = await createTag(token, "Go");

    const created = await createLearningNote(token, { tag_ids: [sqlTag] });
    const noteId = created.body.learningNote.id;

    const updated = await request(`/api/learning-notes/${noteId}`, token, {
      method: "PUT",
      body: JSON.stringify({
        title: "Updated title",
        content: "## Updated body",
        tag_ids: [goTag],
      }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as LearningNoteBody;
    expect(updatedBody.learningNote.title).toBe("Updated title");
    expect(updatedBody.learningNote.content).toBe("## Updated body");
    expect(updatedBody.learningNote.tags.map((tag) => tag.id)).toEqual([goTag]);

    const cleared = await request(`/api/learning-notes/${noteId}`, token, {
      method: "PUT",
      body: JSON.stringify({ tag_ids: [] }),
    });
    const clearedBody = (await cleared.json()) as LearningNoteBody;
    expect(clearedBody.learningNote.tags).toHaveLength(0);
  });

  it("cascades note_tags when the note is deleted", async () => {
    const token = await createUser("note-deleter");
    const tagId = await createTag(token, "Ephemeral");

    const created = await createLearningNote(token, { tag_ids: [tagId] });
    const noteId = created.body.learningNote.id;

    const deleted = await request(`/api/learning-notes/${noteId}`, token, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM note_tags WHERE learning_note_id = ?",
    )
      .bind(noteId)
      .first<{ count: number }>();
    expect(rows?.count).toBe(0);
  });

  it("blocks cross-user read, update and delete with 404", async () => {
    const tokenA = await createUser("note-user-a");
    const tokenB = await createUser("note-user-b");

    const created = await createLearningNote(tokenA);
    expect(created.status).toBe(201);
    const noteId = created.body.learningNote.id;

    const ownRead = await request(`/api/learning-notes/${noteId}`, tokenA);
    expect(ownRead.status).toBe(200);

    const crossRead = await request(`/api/learning-notes/${noteId}`, tokenB);
    expect(crossRead.status).toBe(404);

    const crossUpdate = await request(`/api/learning-notes/${noteId}`, tokenB, {
      method: "PUT",
      body: JSON.stringify({ title: "Hijacked" }),
    });
    expect(crossUpdate.status).toBe(404);

    const crossDelete = await request(`/api/learning-notes/${noteId}`, tokenB, {
      method: "DELETE",
    });
    expect(crossDelete.status).toBe(404);

    const listB = (await (
      await request("/api/learning-notes", tokenB)
    ).json()) as { learningNotes: unknown[] };
    expect(listB.learningNotes).toHaveLength(0);
  });

  it("rejects attaching a tag owned by another user with 404", async () => {
    const tokenA = await createUser("note-tag-owner-a");
    const tokenB = await createUser("note-tag-thief-b");

    const tagId = await createTag(tokenA, "Owned by A");

    const attempt = await createLearningNote(tokenB, { tag_ids: [tagId] });
    expect(attempt.status).toBe(404);

    const listB = (await (
      await request("/api/learning-notes", tokenB)
    ).json()) as { learningNotes: unknown[] };
    expect(listB.learningNotes).toHaveLength(0);
  });

  it("rejects attaching a workspace owned by another user with 404", async () => {
    const tokenA = await createUser("note-ws-owner-a");
    const tokenB = await createUser("note-ws-thief-b");

    const workspaceId = await createWorkspace(tokenA, "Owned by A");

    const attempt = await createLearningNote(tokenB, {
      workspace_id: workspaceId,
    });
    expect(attempt.status).toBe(404);

    const listB = (await (
      await request("/api/learning-notes", tokenB)
    ).json()) as { learningNotes: unknown[] };
    expect(listB.learningNotes).toHaveLength(0);
  });

  it("rejects unauthenticated access to learning notes", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/learning-notes"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
