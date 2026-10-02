import { Hono, type Context } from "hono";
import { and, eq } from "drizzle-orm";

import { createDb } from "@/worker/db";
import { attachments } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

import { findOwnedAttachment } from "./helpers";

function buildObjectHeaders(object: R2Object, range?: R2Range): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  headers.set("Accept-Ranges", "bytes");
  if (range) {
    const start = "offset" in range ? (range.offset ?? object.size - range.length) : 0;
    const length = "length" in range && range.length ? range.length : object.size - start;
    headers.set("Content-Range", `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return headers;
}

async function serveAttachment(c: Context<AppEnv, "/:id">) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const row = await findOwnedAttachment(db, id, userId);
  if (!row) {
    return c.json({ error: "Attachment not found" }, 404);
  }

  const ifNoneMatch = c.req.header("if-none-match");
  if (ifNoneMatch) {
    const headResult = await c.env.STORAGE.get(row.r2Key, {
      onlyIf: c.req.raw.headers,
    });
    if (headResult && !("body" in headResult)) {
      return new Response(null, {
        status: 304,
        headers: buildObjectHeaders(headResult),
      });
    }
  }

  const rangeHeader = c.req.header("range");
  const object = await c.env.STORAGE.get(
    row.r2Key,
    rangeHeader ? { range: c.req.raw.headers } : undefined,
  );
  if (!object) {
    return c.json({ error: "Attachment not found" }, 404);
  }

  const isPartial = Boolean(rangeHeader && object.range);
  const headers = buildObjectHeaders(object, object.range);
  if (!object.httpMetadata?.contentType) {
    headers.set("Content-Type", row.mimeType);
  }

  return new Response(object.body, {
    status: isPartial ? 206 : 200,
    headers,
  });
}

async function deleteAttachment(c: Context<AppEnv, "/:id">) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const row = await findOwnedAttachment(db, id, userId);
  if (!row) {
    return c.json({ error: "Attachment not found" }, 404);
  }

  await c.env.STORAGE.delete(row.r2Key);
  await db
    .delete(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId)));
  return c.json({ success: true });
}

export const attachmentsRoute = new Hono<AppEnv>()
  .get("/:id", serveAttachment)
  .delete("/:id", deleteAttachment);
