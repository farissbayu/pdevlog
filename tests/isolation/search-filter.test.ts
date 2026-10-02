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
  type: "work" | "learning" = "work",
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

type BragLogBody = {
  bragLog: { id: string; title: string };
};

async function createBragLog(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await request("/api/brag-logs", token, {
    method: "POST",
    body: JSON.stringify({
      title: "Shipped the billing migration",
      situation: "Legacy invoices were stored in a fragile format.",
      task: "Migrate all invoices without downtime.",
      action: "Wrote a backfill job and ran it behind a feature flag.",
      result: "Zero downtime and 100% of invoices migrated.",
      occurred_at: "2026-01-15",
      ...overrides,
    }),
  });
}

type NoteBody = {
  note: { id: string; title: string };
};

async function createNote(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await request("/api/notes", token, {
    method: "POST",
    body: JSON.stringify({
      title: "D1 indexes deep dive",
      content: "# Indexes\n\nA composite index helps a lot.",
      ...overrides,
    }),
  });
}

type LogList = { bragLogs: BragLogBody["bragLog"][] };
type NoteList = { notes: NoteBody["note"][] };

async function listLogs(
  token: string,
  query = "",
): Promise<BragLogBody["bragLog"][]> {
  const response = await request(`/api/brag-logs${query}`, token);
  const body = (await response.json()) as LogList;
  return body.bragLogs;
}

async function listNotes(
  token: string,
  query = "",
): Promise<NoteBody["note"][]> {
  const response = await request(`/api/notes${query}`, token);
  const body = (await response.json()) as NoteList;
  return body.notes;
}

describe("brag log search and filter", () => {
  it("searches across all STAR fields case-insensitively", async () => {
    const token = await createUser("filter-brag-search");
    await createBragLog(token, { title: "Docker networking fix" });
    await createBragLog(token, {
      title: "Unrelated",
      situation: "Kubernetes POD scheduling issue",
    });

    expect((await listLogs(token, "?q=docker")).length).toBe(1);
    expect((await listLogs(token, "?q=DOCKER")).length).toBe(1);
    expect((await listLogs(token, "?q=pod")).length).toBe(1);
    expect((await listLogs(token, "?q=nomatch")).length).toBe(0);
  });

  it("filters by workspace, tag and date range", async () => {
    const token = await createUser("filter-brag-combo");
    const work = await createWorkspace(token, "Kerja");
    const tag = await createTag(token, "Go");

    await createBragLog(token, {
      title: "Built an API in Go",
      workspace_id: work,
      tag_ids: [tag],
      occurred_at: "2026-03-10",
    });
    await createBragLog(token, {
      title: "Old API tweak",
      workspace_id: work,
      occurred_at: "2025-01-01",
    });

    const combined = await listLogs(
      token,
      `?workspace_id=${work}&tag_id=${tag}&q=api`,
    );
    expect(combined).toHaveLength(1);
    expect(combined[0].title).toBe("Built an API in Go");

    const ranged = await listLogs(
      token,
      "?from=2026-01-01&to=2026-12-31",
    );
    expect(ranged).toHaveLength(1);
    expect(ranged[0].title).toBe("Built an API in Go");
  });

  it("does not leak other users' logs through search", async () => {
    const tokenA = await createUser("filter-search-a");
    const tokenB = await createUser("filter-search-b");

    await createBragLog(tokenA, { title: "Secret docker migration" });

    expect((await listLogs(tokenB, "?q=docker")).length).toBe(0);
  });
});

describe("note search and filter", () => {
  it("searches title and content case-insensitively", async () => {
    const token = await createUser("filter-note-search");
    await createNote(token, {
      title: "D1 indexes deep dive",
      content: "# Indexes\n\nA covering index helps a lot.",
    });
    await createNote(token, {
      title: "Unrelated",
      content: "Composite indexes help a lot.",
    });

    expect((await listNotes(token, "?q=indexes")).length).toBe(2);
    expect((await listNotes(token, "?q=COMPOSITE")).length).toBe(1);
    expect((await listNotes(token, "?q=nomatch")).length).toBe(0);
  });

  it("filters notes by workspace and tag", async () => {
    const token = await createUser("filter-note-combo");
    const learning = await createWorkspace(token, "Belajar", "learning");
    const tag = await createTag(token, "SQL");

    await createNote(token, {
      title: "D1 indexes deep dive",
      workspace_id: learning,
      tag_ids: [tag],
    });
    await createNote(token, { title: "Untagged note" });

    const byWorkspace = await listNotes(
      token,
      `?workspace_id=${learning}`,
    );
    expect(byWorkspace).toHaveLength(1);

    const byTag = await listNotes(token, `?tag_id=${tag}`);
    expect(byTag).toHaveLength(1);
    expect(byTag[0].title).toBe("D1 indexes deep dive");
  });

  it("does not leak other users' notes through search", async () => {
    const tokenA = await createUser("filter-note-a");
    const tokenB = await createUser("filter-note-b");

    await createNote(tokenA, { title: "Secret composite index" });

    expect((await listNotes(tokenB, "?q=composite")).length).toBe(0);
  });
});
