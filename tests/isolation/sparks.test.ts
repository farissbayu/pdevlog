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

async function createTag(token: string, name: string): Promise<string> {
  const response = await request("/api/tags", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const body = (await response.json()) as { tag: { id: string } };
  return body.tag.id;
}

type SparkBody = {
  spark: {
    id: string;
    content: string;
    status: "open" | "archived" | "promoted";
    promotedType: string | null;
    promotedId: string | null;
    tags: { id: string; name: string }[];
  };
};

async function createSpark(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: SparkBody }> {
  const response = await request("/api/sparks", token, {
    method: "POST",
    body: JSON.stringify({ content: "Try the new D1 read replication", ...overrides }),
  });
  return {
    status: response.status,
    body: (await response.json()) as SparkBody,
  };
}

describe("spark isolation, recall and promotion", () => {
  it("persists content and tags for the owner", async () => {
    const token = await createUser("spark-owner");
    const sqlTag = await createTag(token, "SQL");
    const xTag = await createTag(token, "From X");

    const created = await createSpark(token, { tag_ids: [sqlTag, xTag] });

    expect(created.status).toBe(201);
    expect(created.body.spark.status).toBe("open");
    expect(created.body.spark.content).toContain("D1 read replication");
    expect(created.body.spark.tags.map((tag) => tag.id).sort()).toEqual(
      [sqlTag, xTag].sort(),
    );

    const list = (await (await request("/api/sparks", token)).json()) as {
      sparks: { id: string }[];
    };
    expect(list.sparks).toHaveLength(1);
  });

  it("updates content, status and tags for the owner", async () => {
    const token = await createUser("spark-updater");
    const tagA = await createTag(token, "Alpha");
    const tagB = await createTag(token, "Beta");

    const created = await createSpark(token, { tag_ids: [tagA] });
    const sparkId = created.body.spark.id;

    const updated = await request(`/api/sparks/${sparkId}`, token, {
      method: "PUT",
      body: JSON.stringify({
        content: "Updated idea",
        status: "archived",
        tag_ids: [tagB],
      }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as SparkBody;
    expect(updatedBody.spark.content).toBe("Updated idea");
    expect(updatedBody.spark.status).toBe("archived");
    expect(updatedBody.spark.tags.map((tag) => tag.id)).toEqual([tagB]);
  });

  it("cascades spark_tags when the spark is deleted", async () => {
    const token = await createUser("spark-deleter");
    const tagId = await createTag(token, "Ephemeral");

    const created = await createSpark(token, { tag_ids: [tagId] });
    const sparkId = created.body.spark.id;

    const deleted = await request(`/api/sparks/${sparkId}`, token, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM spark_tags WHERE spark_id = ?",
    )
      .bind(sparkId)
      .first<{ count: number }>();
    expect(rows?.count).toBe(0);
  });

  it("filters by search text and status", async () => {
    const token = await createUser("spark-filter");

    await createSpark(token, { content: "Read about SQLite WAL mode" });
    const archived = await createSpark(token, { content: "Random thought about CSS" });
    await request(`/api/sparks/${archived.body.spark.id}`, token, {
      method: "PUT",
      body: JSON.stringify({ status: "archived" }),
    });

    const search = (await (
      await request("/api/sparks?q=WAL", token)
    ).json()) as { sparks: unknown[] };
    expect(search.sparks).toHaveLength(1);

    const open = (await (
      await request("/api/sparks?status=open", token)
    ).json()) as { sparks: unknown[] };
    expect(open.sparks).toHaveLength(1);

    const archivedList = (await (
      await request("/api/sparks?status=archived", token)
    ).json()) as { sparks: unknown[] };
    expect(archivedList.sparks).toHaveLength(1);
  });

  it("recalls only the caller's open sparks and 404s when empty", async () => {
    const tokenA = await createUser("spark-recall-a");
    const tokenB = await createUser("spark-recall-b");

    const noneB = await request("/api/sparks/random", tokenB);
    expect(noneB.status).toBe(404);

    const created = await createSpark(tokenA, { content: "Recallable spark" });
    const randomA = await request("/api/sparks/random", tokenA);
    expect(randomA.status).toBe(200);
    const randomBody = (await randomA.json()) as SparkBody;
    expect(randomBody.spark.content).toBe("Recallable spark");

    await request(`/api/sparks/${created.body.spark.id}`, tokenA, {
      method: "PUT",
      body: JSON.stringify({ status: "archived" }),
    });
    const afterArchive = await request("/api/sparks/random", tokenA);
    expect(afterArchive.status).toBe(404);
  });

  it("blocks cross-user read, update and delete with 404", async () => {
    const tokenA = await createUser("spark-user-a");
    const tokenB = await createUser("spark-user-b");

    const created = await createSpark(tokenA);
    const sparkId = created.body.spark.id;

    expect((await request(`/api/sparks/${sparkId}`, tokenA)).status).toBe(200);
    expect((await request(`/api/sparks/${sparkId}`, tokenB)).status).toBe(404);
    expect(
      (
        await request(`/api/sparks/${sparkId}`, tokenB, {
          method: "PUT",
          body: JSON.stringify({ content: "Hijacked" }),
        })
      ).status,
    ).toBe(404);
    expect(
      (await request(`/api/sparks/${sparkId}`, tokenB, { method: "DELETE" }))
        .status,
    ).toBe(404);

    const listB = (await (await request("/api/sparks", tokenB)).json()) as {
      sparks: unknown[];
    };
    expect(listB.sparks).toHaveLength(0);
  });

  it("rejects attaching a tag owned by another user with 404", async () => {
    const tokenA = await createUser("spark-tag-owner-a");
    const tokenB = await createUser("spark-tag-thief-b");

    const tagId = await createTag(tokenA, "Owned by A");
    const attempt = await createSpark(tokenB, { tag_ids: [tagId] });
    expect(attempt.status).toBe(404);
  });

  it("promotes a spark into a note atomically", async () => {
    const token = await createUser("spark-promote-note");
    const created = await createSpark(token, { content: "Learn about CRDTs" });
    const sparkId = created.body.spark.id;

    const note = await request("/api/notes", token, {
      method: "POST",
      body: JSON.stringify({
        title: "CRDTs",
        content: "Learn about CRDTs",
        spark_id: sparkId,
      }),
    });
    expect(note.status).toBe(201);
    const noteBody = (await note.json()) as { note: { id: string } };

    const spark = await request(`/api/sparks/${sparkId}`, token);
    const sparkBody = (await spark.json()) as SparkBody;
    expect(sparkBody.spark.status).toBe("promoted");
    expect(sparkBody.spark.promotedType).toBe("note");
    expect(sparkBody.spark.promotedId).toBe(noteBody.note.id);
  });

  it("promotes a spark into a brag log atomically", async () => {
    const token = await createUser("spark-promote-brag");
    const created = await createSpark(token, { content: "Shipped the migration" });
    const sparkId = created.body.spark.id;

    const log = await request("/api/brag-logs", token, {
      method: "POST",
      body: JSON.stringify({
        title: "Migration win",
        situation: "Legacy schema",
        task: "Migrate",
        action: "Shipped the migration",
        result: "Zero downtime",
        occurred_at: "2026-01-01",
        spark_id: sparkId,
      }),
    });
    expect(log.status).toBe(201);
    const logBody = (await log.json()) as { bragLog: { id: string } };

    const spark = await request(`/api/sparks/${sparkId}`, token);
    const sparkBody = (await spark.json()) as SparkBody;
    expect(sparkBody.spark.status).toBe("promoted");
    expect(sparkBody.spark.promotedType).toBe("brag-log");
    expect(sparkBody.spark.promotedId).toBe(logBody.bragLog.id);
  });

  it("rejects promoting a spark owned by another user with 404", async () => {
    const tokenA = await createUser("spark-promo-owner-a");
    const tokenB = await createUser("spark-promo-thief-b");

    const created = await createSpark(tokenA);
    const sparkId = created.body.spark.id;

    const attempt = await request("/api/notes", tokenB, {
      method: "POST",
      body: JSON.stringify({
        title: "Hijack",
        content: "Hijack",
        spark_id: sparkId,
      }),
    });
    expect(attempt.status).toBe(404);

    const listB = (await (await request("/api/notes", tokenB)).json()) as {
      notes: unknown[];
    };
    expect(listB.notes).toHaveLength(0);
  });

  it("rejects unauthenticated access to sparks", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/sparks"),
      env,
    );
    expect(response.status).toBe(401);
  });
});
