import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq, like, ne, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  tagFilterSchema,
  type TagFilterInput,
} from "@/shared/schemas/filters";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/shared/schemas/pagination";
import {
  createTagSchema,
  updateTagSchema,
  type CreateTagInput,
  type TagResponse,
  type UpdateTagInput,
} from "@/shared/schemas/tag";
import { createDb } from "@/worker/db";
import { tags, type TagRow } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

type JsonInput<T> = { in: { json: T }; out: { json: T } };
type QueryInput<T> = { in: { query: T }; out: { query: T } };

const DUPLICATE_TAG_ERROR = "A tag with this name already exists";

function toTagResponse(tag: TagRow): TagResponse {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: new Date(tag.createdAt).toISOString(),
  };
}

async function findOwnedTag(
  db: ReturnType<typeof createDb>,
  id: string,
  userId: string,
): Promise<TagRow | undefined> {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .limit(1);
  return tag;
}

const listTags = async (
  c: Context<AppEnv, "/", QueryInput<TagFilterInput>>,
) => {
  const userId = c.get("userId");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(tags.userId, userId)];

  if (filters.q) {
    conditions.push(like(tags.name, `%${filters.q}%`));
  }

  const where = and(...conditions);
  const { page, pageSize } = parsePagination(filters);

  const [totalRow] = await db
    .select({ value: count() })
    .from(tags)
    .where(where);
  const total = totalRow?.value ?? 0;

  const query = db
    .select()
    .from(tags)
    .where(where)
    .orderBy(asc(tags.name), asc(tags.id));

  const rows =
    page === null
      ? await query
      : await query.limit(pageSize).offset((page - 1) * pageSize);

  return c.json({
    tags: rows.map(toTagResponse),
    pagination: buildPaginationMeta(total, page, pageSize),
  });
};

const createTagHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateTagInput>>,
) => {
  const userId = c.get("userId");
  const { name } = c.req.valid("json");
  const db = createDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, name)))
    .limit(1);

  if (existing) {
    return c.json({ error: DUPLICATE_TAG_ERROR }, 409);
  }

  try {
    const [created] = await db
      .insert(tags)
      .values({ id: nanoid(), userId, name, createdAt: new Date() })
      .returning();

    return c.json({ tag: toTagResponse(created) }, 201);
  } catch {
    return c.json({ error: DUPLICATE_TAG_ERROR }, 409);
  }
};

const updateTagHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateTagInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { name } = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedTag(db, id, userId);
  if (!owned) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const [duplicate] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, name), ne(tags.id, id)))
    .limit(1);

  if (duplicate) {
    return c.json({ error: DUPLICATE_TAG_ERROR }, 409);
  }

  try {
    const [updated] = await db
      .update(tags)
      .set({ name })
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .returning();

    if (!updated) {
      return c.json({ error: "Tag not found" }, 404);
    }

    return c.json({ tag: toTagResponse(updated) });
  } catch {
    return c.json({ error: DUPLICATE_TAG_ERROR }, 409);
  }
};

const deleteTagHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Tag not found" }, 404);
  }

  return c.json({ success: true });
};

export const tagsRoute = new Hono<AppEnv>()
  .get("/", zValidator("query", tagFilterSchema), listTags)
  .post("/", zValidator("json", createTagSchema), createTagHandler)
  .put("/:id", zValidator("json", updateTagSchema), updateTagHandler)
  .delete("/:id", deleteTagHandler);
