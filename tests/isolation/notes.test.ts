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

async function createWorkspace(
  token: string,
  name: string,
  type: "work" | "learning" | "general" = "learning",
): Promise<string> {
  const response = await request("/api/workspaces", token, {
    method: "POST",
    body: JSON.stringify({ name, type }),
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

type NoteSource = {
  id: string;
  url: string | null;
  label: string | null;
  kind: string | null;
  locator: string | null;
};

type NoteBody = {
  note: {
    id: string;
    title: string;
    content: string;
    workspaceId: string | null;
    workspace: {
      id: string;
      name: string;
      sources: NoteSource[];
    } | null;
    tags: { id: string; name: string }[];
    sources: NoteSource[];
  };
};

function notePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "D1 indexes deep dive",
    content: "# Indexes\n\nA composite index helps a lot.",
    ...overrides,
  };
}

async function createNote(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: NoteBody }> {
  const response = await request("/api/notes", token, {
    method: "POST",
    body: JSON.stringify(notePayload(overrides)),
  });
  return {
    status: response.status,
    body: (await response.json()) as NoteBody,
  };
}

describe("note isolation and relation ownership", () => {
  it("persists tags and workspace for the owner", async () => {
    const tokenA = await createUser("note-owner");
    const workspaceId = await createWorkspace(tokenA, "Databases");
    const sqlTag = await createTag(tokenA, "SQL");
    const cfTag = await createTag(tokenA, "Cloudflare");

    const created = await createNote(tokenA, {
      workspace_id: workspaceId,
      tag_ids: [sqlTag, cfTag],
    });

    expect(created.status).toBe(201);
    expect(created.body.note.workspaceId).toBe(workspaceId);
    expect(created.body.note.content).toContain("# Indexes");
    expect(
      created.body.note.tags.map((tag) => tag.id).sort(),
    ).toEqual([sqlTag, cfTag].sort());

    const detail = await request(
      `/api/notes/${created.body.note.id}`,
      tokenA,
    );
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as NoteBody;
    expect(detailBody.note.tags).toHaveLength(2);
    expect(detailBody.note.workspaceId).toBe(workspaceId);

    const list = (await (
      await request("/api/notes", tokenA)
    ).json()) as { notes: unknown[] };
    expect(list.notes).toHaveLength(1);
  });

  it("updates fields and syncs junction tags for the owner", async () => {
    const token = await createUser("note-updater");
    const sqlTag = await createTag(token, "SQL");
    const goTag = await createTag(token, "Go");

    const created = await createNote(token, { tag_ids: [sqlTag] });
    const noteId = created.body.note.id;

    const updated = await request(`/api/notes/${noteId}`, token, {
      method: "PUT",
      body: JSON.stringify({
        title: "Updated title",
        content: "## Updated body",
        tag_ids: [goTag],
      }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as NoteBody;
    expect(updatedBody.note.title).toBe("Updated title");
    expect(updatedBody.note.content).toBe("## Updated body");
    expect(updatedBody.note.tags.map((tag) => tag.id)).toEqual([goTag]);

    const cleared = await request(`/api/notes/${noteId}`, token, {
      method: "PUT",
      body: JSON.stringify({ tag_ids: [] }),
    });
    const clearedBody = (await cleared.json()) as NoteBody;
    expect(clearedBody.note.tags).toHaveLength(0);
  });

  it("cascades note_tags when the note is deleted", async () => {
    const token = await createUser("note-deleter");
    const tagId = await createTag(token, "Ephemeral");

    const created = await createNote(token, { tag_ids: [tagId] });
    const noteId = created.body.note.id;

    const deleted = await request(`/api/notes/${noteId}`, token, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM note_tags WHERE note_id = ?",
    )
      .bind(noteId)
      .first<{ count: number }>();
    expect(rows?.count).toBe(0);
  });

  it("persists and returns note sources in create, detail and list", async () => {
    const token = await createUser("note-source-owner");

    const created = await createNote(token, {
      sources: [
        { url: "https://example.com/a", label: "Example A" },
        { url: "https://example.com/b" },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.body.note.sources.map((source) => source.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(created.body.note.sources[0]?.label).toBe("Example A");
    expect(created.body.note.sources[1]?.label).toBeNull();

    const detail = await request(
      `/api/notes/${created.body.note.id}`,
      token,
    );
    const detailBody = (await detail.json()) as NoteBody;
    expect(detailBody.note.sources).toHaveLength(2);

    const list = (await (await request("/api/notes", token)).json()) as {
      notes: { sources: NoteSource[] }[];
    };
    expect(list.notes[0]?.sources).toHaveLength(2);
  });

  it("replaces the whole source set on update", async () => {
    const token = await createUser("note-source-updater");

    const created = await createNote(token, {
      sources: [
        { url: "https://example.com/a", label: "A" },
        { url: "https://example.com/b", label: "B" },
      ],
    });
    const noteId = created.body.note.id;

    const updated = await request(`/api/notes/${noteId}`, token, {
      method: "PUT",
      body: JSON.stringify({
        sources: [
          { url: "https://example.com/b", label: "B" },
          { url: "https://example.com/c" },
        ],
      }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as NoteBody;
    expect(updatedBody.note.sources.map((source) => source.url)).toEqual([
      "https://example.com/b",
      "https://example.com/c",
    ]);

    const cleared = await request(`/api/notes/${noteId}`, token, {
      method: "PUT",
      body: JSON.stringify({ sources: [] }),
    });
    const clearedBody = (await cleared.json()) as NoteBody;
    expect(clearedBody.note.sources).toHaveLength(0);
  });

  it("rejects invalid source URLs with 400", async () => {
    const token = await createUser("note-source-invalid");

    const ftp = await createNote(token, {
      sources: [{ url: "ftp://example.com" }],
    });
    expect(ftp.status).toBe(400);

    const notAUrl = await createNote(token, {
      sources: [{ url: "not-a-url" }],
    });
    expect(notAUrl.status).toBe(400);
  });

  it("supports sources on a standalone note found by the Unassigned filter", async () => {
    const token = await createUser("note-source-standalone");

    const created = await createNote(token, {
      sources: [{ url: "https://example.com/standalone" }],
    });
    expect(created.status).toBe(201);
    expect(created.body.note.workspaceId).toBeNull();
    expect(created.body.note.sources).toHaveLength(1);

    const list = (await (
      await request("/api/notes?workspace_id=none", token)
    ).json()) as { notes: { sources: NoteSource[] }[] };
    expect(list.notes).toHaveLength(1);
    expect(list.notes[0]?.sources).toHaveLength(1);
  });

  it("does not expose another user's note sources", async () => {
    const tokenA = await createUser("note-source-owner-a");
    const tokenB = await createUser("note-source-owner-b");

    const created = await createNote(tokenA, {
      sources: [{ url: "https://example.com/private" }],
    });

    const crossRead = await request(
      `/api/notes/${created.body.note.id}`,
      tokenB,
    );
    expect(crossRead.status).toBe(404);

    const listB = (await (
      await request("/api/notes", tokenB)
    ).json()) as { notes: unknown[] };
    expect(listB.notes).toHaveLength(0);
  });

  it("removes note-owned sources when the note is deleted", async () => {
    const token = await createUser("note-source-deleter");

    const created = await createNote(token, {
      sources: [{ url: "https://example.com/one" }],
    });
    const noteId = created.body.note.id;

    const deleted = await request(`/api/notes/${noteId}`, token, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM sources WHERE owner_type = 'note' AND owner_id = ?",
    )
      .bind(noteId)
      .first<{ count: number }>();
    expect(rows?.count).toBe(0);
  });

  it("stores a source without a URL with kind and locator", async () => {
    const token = await createUser("note-source-book");

    const created = await createNote(token, {
      sources: [{ label: "Clean Code", kind: "book", locator: "p.120" }],
    });
    expect(created.status).toBe(201);
    const source = created.body.note.sources[0];
    expect(source?.url).toBeNull();
    expect(source?.label).toBe("Clean Code");
    expect(source?.kind).toBe("book");
    expect(source?.locator).toBe("p.120");
  });

  it("rejects a source with neither URL nor label", async () => {
    const token = await createUser("note-source-empty");

    const attempt = await createNote(token, {
      sources: [{ kind: "book" }],
    });
    expect(attempt.status).toBe(400);
  });

  it("inherits workspace sources into note responses", async () => {
    const token = await createUser("note-source-inherit");

    const wsResponse = await request("/api/workspaces", token, {
      method: "POST",
      body: JSON.stringify({
        name: "Long lecture",
        type: "learning",
        sources: [
          {
            url: "https://youtu.be/abc123",
            label: "Full lecture",
            kind: "video",
          },
        ],
      }),
    });
    expect(wsResponse.status).toBe(201);
    const wsBody = (await wsResponse.json()) as {
      workspace: { id: string; sources: NoteSource[] };
    };
    expect(wsBody.workspace.sources).toHaveLength(1);

    const created = await createNote(token, {
      workspace_id: wsBody.workspace.id,
      sources: [{ label: "Section 1", locator: "0:00-5:00", kind: "video" }],
    });
    expect(created.status).toBe(201);
    expect(created.body.note.sources).toHaveLength(1);
    expect(created.body.note.workspace?.sources).toHaveLength(1);
    expect(created.body.note.workspace?.sources[0]?.url).toBe(
      "https://youtu.be/abc123",
    );

    const detail = await request(
      `/api/notes/${created.body.note.id}`,
      token,
    );
    const detailBody = (await detail.json()) as NoteBody;
    expect(detailBody.note.workspace?.sources).toHaveLength(1);
  });

  it("blocks cross-user read, update and delete with 404", async () => {
    const tokenA = await createUser("note-user-a");
    const tokenB = await createUser("note-user-b");

    const created = await createNote(tokenA);
    expect(created.status).toBe(201);
    const noteId = created.body.note.id;

    const ownRead = await request(`/api/notes/${noteId}`, tokenA);
    expect(ownRead.status).toBe(200);

    const crossRead = await request(`/api/notes/${noteId}`, tokenB);
    expect(crossRead.status).toBe(404);

    const crossUpdate = await request(`/api/notes/${noteId}`, tokenB, {
      method: "PUT",
      body: JSON.stringify({ title: "Hijacked" }),
    });
    expect(crossUpdate.status).toBe(404);

    const crossDelete = await request(`/api/notes/${noteId}`, tokenB, {
      method: "DELETE",
    });
    expect(crossDelete.status).toBe(404);

    const listB = (await (
      await request("/api/notes", tokenB)
    ).json()) as { notes: unknown[] };
    expect(listB.notes).toHaveLength(0);
  });

  it("rejects attaching a tag owned by another user with 404", async () => {
    const tokenA = await createUser("note-tag-owner-a");
    const tokenB = await createUser("note-tag-thief-b");

    const tagId = await createTag(tokenA, "Owned by A");

    const attempt = await createNote(tokenB, { tag_ids: [tagId] });
    expect(attempt.status).toBe(404);

    const listB = (await (
      await request("/api/notes", tokenB)
    ).json()) as { notes: unknown[] };
    expect(listB.notes).toHaveLength(0);
  });

  it("rejects attaching a workspace owned by another user with 404", async () => {
    const tokenA = await createUser("note-ws-owner-a");
    const tokenB = await createUser("note-ws-thief-b");

    const workspaceId = await createWorkspace(tokenA, "Owned by A");

    const attempt = await createNote(tokenB, {
      workspace_id: workspaceId,
    });
    expect(attempt.status).toBe(404);

    const listB = (await (
      await request("/api/notes", tokenB)
    ).json()) as { notes: unknown[] };
    expect(listB.notes).toHaveLength(0);
  });

  it("attaches notes to work and general workspaces and filters by workspace", async () => {
    const token = await createUser("note-any-workspace");
    const workId = await createWorkspace(token, "Day job", "work");
    const generalId = await createWorkspace(token, "Misc", "general");

    const inWork = await createNote(token, { workspace_id: workId });
    expect(inWork.status).toBe(201);
    expect(inWork.body.note.workspaceId).toBe(workId);

    const inGeneral = await createNote(token, {
      title: "General note",
      workspace_id: generalId,
    });
    expect(inGeneral.status).toBe(201);
    expect(inGeneral.body.note.workspaceId).toBe(generalId);

    const workList = (await (
      await request(`/api/notes?workspace_id=${workId}`, token)
    ).json()) as { notes: { id: string }[] };
    expect(workList.notes.map((note) => note.id)).toContain(
      inWork.body.note.id,
    );

    const generalList = (await (
      await request(`/api/notes?workspace_id=${generalId}`, token)
    ).json()) as { notes: { id: string }[] };
    expect(generalList.notes.map((note) => note.id)).toContain(
      inGeneral.body.note.id,
    );
  });

  it("finds standalone notes with the Unassigned filter", async () => {
    const token = await createUser("note-standalone-filter");

    const created = await createNote(token, { title: "Loose note" });
    expect(created.status).toBe(201);
    expect(created.body.note.workspaceId).toBeNull();

    const unassigned = (await (
      await request("/api/notes?workspace_id=none", token)
    ).json()) as { notes: { id: string }[] };
    expect(unassigned.notes.map((note) => note.id)).toContain(
      created.body.note.id,
    );
  });

  it("rejects unauthenticated access to notes", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/notes"),
      env,
    );

    expect(response.status).toBe(401);
  });
});
