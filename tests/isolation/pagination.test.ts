import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

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
  description?: string,
): Promise<string> {
  const response = await request("/api/workspaces", token, {
    method: "POST",
    body: JSON.stringify({ name, type, description }),
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

type WorkspaceList = {
  workspaces: { id: string; name: string }[];
  pagination: PaginationMeta;
};

async function listWorkspaces(
  token: string,
  query = "",
): Promise<WorkspaceList> {
  const response = await request(`/api/workspaces${query}`, token);
  return (await response.json()) as WorkspaceList;
}

type TagList = {
  tags: { id: string; name: string }[];
  pagination: PaginationMeta;
};

async function listTags(token: string, query = ""): Promise<TagList> {
  const response = await request(`/api/tags${query}`, token);
  return (await response.json()) as TagList;
}

type LogList = {
  bragLogs: { id: string; title: string }[];
  pagination: PaginationMeta;
};

async function listLogs(token: string, query = ""): Promise<LogList> {
  const response = await request(`/api/brag-logs${query}`, token);
  return (await response.json()) as LogList;
}

type NoteList = {
  notes: { id: string; title: string }[];
  pagination: PaginationMeta;
};

async function listNotes(token: string, query = ""): Promise<NoteList> {
  const response = await request(`/api/notes${query}`, token);
  return (await response.json()) as NoteList;
}

describe("workspace search and pagination", () => {
  it("searches by name and description", async () => {
    const token = await createUser("page-workspace-search");
    await createWorkspace(token, "Alpha", "work", "First project");
    await createWorkspace(token, "Beta", "learning");
    await createWorkspace(token, "Gamma", "work", "Another thing");

    const byName = await listWorkspaces(token, "?q=alpha");
    expect(byName.workspaces).toHaveLength(1);
    expect(byName.workspaces[0].name).toBe("Alpha");

    const byDescription = await listWorkspaces(token, "?q=project");
    expect(byDescription.workspaces).toHaveLength(1);
    expect(byDescription.workspaces[0].name).toBe("Alpha");

    const noMatch = await listWorkspaces(token, "?q=nomatch");
    expect(noMatch.workspaces).toHaveLength(0);
  });

  it("paginates and reports total counts", async () => {
    const token = await createUser("page-workspace-list");
    await createWorkspace(token, "Alpha");
    await createWorkspace(token, "Beta");
    await createWorkspace(token, "Gamma");

    const page1 = await listWorkspaces(token, "?page=1&page_size=2");
    expect(page1.workspaces).toHaveLength(2);
    expect(page1.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });

    const page2 = await listWorkspaces(token, "?page=2&page_size=2");
    expect(page2.workspaces).toHaveLength(1);
    expect(page2.pagination.page).toBe(2);
  });
});

describe("tag search and pagination", () => {
  it("searches by name and paginates", async () => {
    const token = await createUser("page-tag");
    await createTag(token, "Docker");
    await createTag(token, "Go");
    await createTag(token, "React");

    const byName = await listTags(token, "?q=do");
    expect(byName.tags).toHaveLength(1);
    expect(byName.tags[0].name).toBe("Docker");

    const page1 = await listTags(token, "?page=1&page_size=2");
    expect(page1.tags).toHaveLength(2);
    expect(page1.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });

    const page2 = await listTags(token, "?page=2&page_size=2");
    expect(page2.tags).toHaveLength(1);
  });
});

describe("workspace-scoped pagination", () => {
  it("paginates brag logs within a workspace", async () => {
    const token = await createUser("page-scoped-logs");
    const workspace = await createWorkspace(token, "Work");
    const other = await createWorkspace(token, "Other");

    for (let index = 0; index < 5; index += 1) {
      await createBragLog(token, {
        title: `Log ${index}`,
        workspace_id: workspace,
      });
    }
    await createBragLog(token, { title: "Other log", workspace_id: other });

    const page1 = await listLogs(
      token,
      `?workspace_id=${workspace}&page=1&page_size=2`,
    );
    expect(page1.bragLogs).toHaveLength(2);
    expect(page1.pagination).toMatchObject({ total: 5, totalPages: 3 });

    const page3 = await listLogs(
      token,
      `?workspace_id=${workspace}&page=3&page_size=2`,
    );
    expect(page3.bragLogs).toHaveLength(1);
  });

  it("searches brag logs within a workspace", async () => {
    const token = await createUser("page-scoped-log-search");
    const workspace = await createWorkspace(token, "Work");
    await createBragLog(token, { title: "Docker fix", workspace_id: workspace });
    await createBragLog(token, { title: "Kubernetes fix", workspace_id: workspace });

    const result = await listLogs(token, `?workspace_id=${workspace}&q=docker`);
    expect(result.bragLogs).toHaveLength(1);
    expect(result.bragLogs[0].title).toBe("Docker fix");
  });

  it("paginates notes within a workspace", async () => {
    const token = await createUser("page-scoped-notes");
    const workspace = await createWorkspace(token, "Belajar", "learning");
    const other = await createWorkspace(token, "Other", "learning");

    for (let index = 0; index < 5; index += 1) {
      await createNote(token, {
        title: `Note ${index}`,
        workspace_id: workspace,
      });
    }
    await createNote(token, { title: "Other note", workspace_id: other });

    const page1 = await listNotes(
      token,
      `?workspace_id=${workspace}&page=1&page_size=2`,
    );
    expect(page1.notes).toHaveLength(2);
    expect(page1.pagination).toMatchObject({ total: 5, totalPages: 3 });

    const page3 = await listNotes(
      token,
      `?workspace_id=${workspace}&page=3&page_size=2`,
    );
    expect(page3.notes).toHaveLength(1);
  });
});

describe("pagination data isolation", () => {
  it("does not leak other users' workspaces through search or totals", async () => {
    const tokenA = await createUser("page-iso-a");
    const tokenB = await createUser("page-iso-b");

    await createWorkspace(tokenA, "Secret Alpha", "work", "Hidden project");
    await createWorkspace(tokenA, "Secret Beta");

    const searchB = await listWorkspaces(tokenB, "?q=secret");
    expect(searchB.workspaces).toHaveLength(0);
    expect(searchB.pagination.total).toBe(0);

    const pageB = await listWorkspaces(tokenB, "?page=1&page_size=1");
    expect(pageB.workspaces).toHaveLength(0);
    expect(pageB.pagination.total).toBe(0);
  });
});
