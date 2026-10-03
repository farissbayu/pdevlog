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

function pngFile(name = "shot.png"): File {
  return new File([PNG_BYTES], name, { type: "image/png" });
}

async function createNote(
  token: string,
  content = "Note body",
): Promise<string> {
  const response = await request("/api/notes", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "My note", content }),
  });
  const body = (await response.json()) as { note: { id: string } };
  return body.note.id;
}

async function upload(
  token: string,
  noteId: string,
  file: File,
): Promise<Response> {
  const form = new FormData();
  form.append("file", file);
  return request(`/api/notes/${noteId}/attachments`, token, {
    method: "POST",
    body: form,
  });
}

async function updateContent(
  token: string,
  noteId: string,
  content: string,
): Promise<Response> {
  return request(`/api/notes/${noteId}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

type NoteBody = {
  note: {
    id: string;
    attachments: { id: string; url: string; mimeType: string }[];
  };
};

describe("note image attachments", () => {
  it("uploads an image and serves it through the universal proxy", async () => {
    const token = await createUser("note-att-owner");
    const noteId = await createNote(token);

    const uploaded = await upload(token, noteId, pngFile());
    expect(uploaded.status).toBe(201);
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string; url: string; mimeType: string };
    };
    expect(attachment.mimeType).toBe("image/png");
    expect(attachment.url).toBe(`/api/attachments/${attachment.id}`);

    const image = await request(`/api/attachments/${attachment.id}`, token);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await image.arrayBuffer());
    expect(Array.from(bytes)).toEqual(Array.from(PNG_BYTES));
  });

  it("blocks cross-user access to note attachments", async () => {
    const tokenA = await createUser("note-att-a");
    const tokenB = await createUser("note-att-b");
    const noteId = await createNote(tokenA);
    const uploaded = await upload(tokenA, noteId, pngFile());
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string };
    };

    expect(
      (await request(`/api/attachments/${attachment.id}`, tokenA)).status,
    ).toBe(200);
    expect(
      (await request(`/api/attachments/${attachment.id}`, tokenB)).status,
    ).toBe(404);

    const crossUpload = await upload(tokenB, noteId, pngFile());
    expect(crossUpload.status).toBe(404);
  });

  it("prunes attachments that are no longer referenced in the content", async () => {
    const token = await createUser("note-att-prune");
    const noteId = await createNote(token);

    const uploaded = await upload(token, noteId, pngFile());
    const { attachment } = (await uploaded.json()) as {
      attachment: { id: string; url: string };
    };

    const prefix = "attachments/note-att-prune/";
    expect((await env.STORAGE.list({ prefix })).objects).toHaveLength(1);

    const referenced = await updateContent(
      token,
      noteId,
      `Keep me\n\n![image](${attachment.url})`,
    );
    expect(referenced.status).toBe(200);
    let detail = (await (await request(`/api/notes/${noteId}`, token)).json()) as NoteBody;
    expect(detail.note.attachments).toHaveLength(1);

    const unreferenced = await updateContent(token, noteId, "Removed the image");
    expect(unreferenced.status).toBe(200);
    detail = (await (await request(`/api/notes/${noteId}`, token)).json()) as NoteBody;
    expect(detail.note.attachments).toHaveLength(0);
    expect((await env.STORAGE.list({ prefix })).objects).toHaveLength(0);
    expect(
      (await request(`/api/attachments/${attachment.id}`, token)).status,
    ).toBe(404);
  });

  it("enforces the per-note attachment limit", async () => {
    const token = await createUser("note-att-limit");
    const noteId = await createNote(token);

    for (let index = 0; index < MAX_STORAGE_PER_OWNER; index += 1) {
      const response = await upload(token, noteId, pngFile(`n${index}.png`));
      expect(response.status).toBe(201);
    }

    const overflow = await upload(
      token,
      noteId,
      pngFile(`n${MAX_STORAGE_PER_OWNER}.png`),
    );
    expect(overflow.status).toBe(400);
  });
});
