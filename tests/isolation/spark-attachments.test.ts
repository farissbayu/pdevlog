import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import { MAX_STORAGE_PER_OWNER } from "@/shared/schemas/attachment";
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
  return app.fetch(
    new Request(`https://example.com${path}`, { ...init, headers }),
    env,
  );
}

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function pngFile(name = "shot.png", bytes = PNG_BYTES): File {
  return new File([bytes], name, { type: "image/png" });
}

async function createSpark(token: string, content = "A spark"): Promise<string> {
  const response = await request("/api/sparks", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const body = (await response.json()) as { spark: { id: string } };
  return body.spark.id;
}

async function upload(
  token: string,
  sparkId: string,
  file: File,
): Promise<Response> {
  const form = new FormData();
  form.append("file", file);
  return request(`/api/sparks/${sparkId}/attachments`, token, {
    method: "POST",
    body: form,
  });
}

type SparkBody = {
  spark: {
    id: string;
    attachments: {
      id: string;
      ownerType: string;
      ownerId: string;
      mimeType: string;
      size: number;
      url: string;
    }[];
  };
};

describe("spark image attachments", () => {
  it("uploads an image and serves it back through the proxy", async () => {
    const token = await createUser("att-owner");
    const sparkId = await createSpark(token);

    const uploaded = await upload(token, sparkId, pngFile());
    expect(uploaded.status).toBe(201);
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string; url: string; mimeType: string };
    };
    expect(attachment.mimeType).toBe("image/png");
    expect(attachment.url).toBe(`/api/attachments/${attachment.id}`);

    const detail = await request(`/api/sparks/${sparkId}`, token);
    const body = (await detail.json()) as SparkBody;
    expect(body.spark.attachments).toHaveLength(1);

    const image = await request(`/api/attachments/${attachment.id}`, token);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(image.headers.get("cache-control")).toContain("private");
    const bytes = new Uint8Array(await image.arrayBuffer());
    expect(Array.from(bytes)).toEqual(Array.from(PNG_BYTES));
  });

  it("supports conditional and range requests", async () => {
    const token = await createUser("att-range");
    const sparkId = await createSpark(token);
    const uploaded = await upload(token, sparkId, pngFile("r.png"));
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string };
    };

    const first = await request(`/api/attachments/${attachment.id}`, token);
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    const notModified = await request(
      `/api/attachments/${attachment.id}`,
      token,
      { headers: { "If-None-Match": etag! } },
    );
    expect(notModified.status).toBe(304);

    const partial = await request(
      `/api/attachments/${attachment.id}`,
      token,
      { headers: { Range: "bytes=0-3" } },
    );
    expect(partial.status).toBe(206);
    expect((await partial.arrayBuffer()).byteLength).toBe(4);
  });

  it("rejects unsupported types and oversized files", async () => {
    const token = await createUser("att-validate");
    const sparkId = await createSpark(token);

    const badType = await upload(
      token,
      sparkId,
      new File(["hello"], "note.txt", { type: "text/plain" }),
    );
    expect(badType.status).toBe(400);

    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const tooLarge = await upload(token, sparkId, pngFile("big.png", big));
    expect(tooLarge.status).toBe(400);
  });

  it("enforces the per-owner attachment limit", async () => {
    const token = await createUser("att-limit");
    const sparkId = await createSpark(token);

    for (let index = 0; index < MAX_STORAGE_PER_OWNER; index += 1) {
      const response = await upload(token, sparkId, pngFile(`s${index}.png`));
      expect(response.status).toBe(201);
    }

    const overflow = await upload(
      token,
      sparkId,
      pngFile(`s${MAX_STORAGE_PER_OWNER}.png`),
    );
    expect(overflow.status).toBe(400);
  });

  it("blocks cross-user access to attachments with 404", async () => {
    const tokenA = await createUser("att-a");
    const tokenB = await createUser("att-b");
    const sparkId = await createSpark(tokenA);
    const uploaded = await upload(tokenA, sparkId, pngFile());
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string };
    };

    expect(
      (await request(`/api/attachments/${attachment.id}`, tokenA)).status,
    ).toBe(200);
    expect(
      (await request(`/api/attachments/${attachment.id}`, tokenB)).status,
    ).toBe(404);
    expect(
      (
        await request(`/api/attachments/${attachment.id}`, tokenB, {
          method: "DELETE",
        })
      ).status,
    ).toBe(404);

    const crossUpload = await upload(tokenB, sparkId, pngFile());
    expect(crossUpload.status).toBe(404);
  });

  it("deletes R2 objects and rows when the spark is deleted", async () => {
    const token = await createUser("att-delete");
    const sparkId = await createSpark(token);
    const uploaded = await upload(token, sparkId, pngFile());
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string };
    };

    const prefix = "attachments/att-delete/";
    const stored = await env.STORAGE.list({ prefix });
    expect(stored.objects).toHaveLength(1);

    const deleted = await request(`/api/sparks/${sparkId}`, token, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const remaining = await env.STORAGE.list({ prefix });
    expect(remaining.objects).toHaveLength(0);
    expect(
      (await request(`/api/attachments/${attachment.id}`, token)).status,
    ).toBe(404);
  });

  it("carries attachments when promoting a spark into a note", async () => {
    const token = await createUser("att-promote");
    const sparkId = await createSpark(token, "Promote me");
    const uploaded = await upload(token, sparkId, pngFile());
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string };
    };

    const note = await request("/api/notes", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Promoted note",
        content: "Promoted note",
        spark_id: sparkId,
      }),
    });
    expect(note.status).toBe(201);
    const noteBody = (await note.json()) as {
      note: { id: string; attachments: { id: string }[] };
    };
    expect(noteBody.note.attachments).toHaveLength(1);
    expect(noteBody.note.attachments[0].id).toBe(attachment.id);

    const ownerRow = await env.DB.prepare(
      "SELECT owner_type AS ownerType FROM attachments WHERE id = ?",
    )
      .bind(attachment.id)
      .first<{ ownerType: string }>();
    expect(ownerRow?.ownerType).toBe("note");

    const spark = await request(`/api/sparks/${sparkId}`, token);
    const sparkBody = (await spark.json()) as SparkBody;
    expect(sparkBody.spark.attachments).toHaveLength(0);

    expect(
      (await request(`/api/attachments/${attachment.id}`, token)).status,
    ).toBe(200);
  });

  it("rejects unauthenticated attachment access", async () => {
    const response = await app.fetch(
      new Request("https://example.com/api/attachments/nope"),
      env,
    );
    expect(response.status).toBe(401);
  });
});
