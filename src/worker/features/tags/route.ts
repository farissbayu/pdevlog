import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, ne } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

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

const listTags = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(asc(tags.name));

  return c.json({ tags: rows.map(toTagResponse) });
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
  .get("/", listTags)
  .post("/", zValidator("json", createTagSchema), createTagHandler)
  .put("/:id", zValidator("json", updateTagSchema), updateTagHandler)
  .delete("/:id", deleteTagHandler);
