import { zValidator } from "@hono/zod-validator";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";

import {
  normalizeTagIds,
  sparkFilterSchema,
  type SparkFilterInput,
} from "@/shared/schemas/filters";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/shared/schemas/pagination";
import {
  createSparkSchema,
  updateSparkSchema,
  type CreateSparkInput,
  type SparkResponse,
  type UpdateSparkInput,
} from "@/shared/schemas/spark";
import type { TagResponse } from "@/shared/schemas/tag";
import { createDb, type Database } from "@/worker/db";
import {
  sparkTags,
  sparks,
  tags,
  type AttachmentRow,
  type SparkRow,
  type TagRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import {
  AttachmentUploadError,
  createAttachment,
  deleteOwnedAttachments,
  loadAttachments,
  loadAttachmentsByOwnerIds,
  toAttachmentResponse,
} from "@/worker/features/attachments/helpers";

type JsonInput<T> = { in: { json: T }; out: { json: T } };
type QueryInput<T> = { in: { query: T }; out: { query: T } };

function toTagResponse(tag: TagRow): TagResponse {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: new Date(tag.createdAt).toISOString(),
  };
}

function toSparkResponse(
  spark: SparkRow,
  sparkTagList: TagRow[],
  attachmentRows: AttachmentRow[],
): SparkResponse {
  return {
    id: spark.id,
    content: spark.content,
    status: spark.status,
    promotedType: spark.promotedType,
    promotedId: spark.promotedId,
    tags: sparkTagList.map(toTagResponse),
    attachments: attachmentRows.map(toAttachmentResponse),
    createdAt: new Date(spark.createdAt).toISOString(),
    updatedAt: new Date(spark.updatedAt).toISOString(),
  };
}

async function findOwnedSpark(
  db: Database,
  id: string,
  userId: string,
): Promise<SparkRow | undefined> {
  const [spark] = await db
    .select()
    .from(sparks)
    .where(and(eq(sparks.id, id), eq(sparks.userId, userId)))
    .limit(1);
  return spark;
}

async function loadTagsForSpark(
  db: Database,
  sparkId: string,
  userId: string,
): Promise<TagRow[]> {
  const rows = await db
    .select({ tag: tags })
    .from(sparkTags)
    .innerJoin(tags, eq(sparkTags.tagId, tags.id))
    .where(and(eq(sparkTags.sparkId, sparkId), eq(tags.userId, userId)));
  return rows.map((row) => row.tag);
}

async function loadTagsBySparkIds(
  db: Database,
  sparkIds: string[],
  userId: string,
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (sparkIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({ sparkId: sparkTags.sparkId, tag: tags })
    .from(sparkTags)
    .innerJoin(tags, eq(sparkTags.tagId, tags.id))
    .where(and(inArray(sparkTags.sparkId, sparkIds), eq(tags.userId, userId)));

  for (const row of rows) {
    const list = map.get(row.sparkId) ?? [];
    list.push(row.tag);
    map.set(row.sparkId, list);
  }
  return map;
}

async function validateTagOwnership(
  db: Database,
  tagIds: string[],
  userId: string,
): Promise<boolean> {
  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length === 0) {
    return true;
  }
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.id, uniqueIds)));
  return rows.length === uniqueIds.length;
}

const listSparks = async (
  c: Context<AppEnv, "/", QueryInput<SparkFilterInput>>,
) => {
  const userId = c.get("userId");
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(sparks.userId, userId)];

  if (filters.q) {
    conditions.push(like(sparks.content, `%${filters.q}%`));
  }

  if (filters.status) {
    conditions.push(eq(sparks.status, filters.status));
  }

  if (filters.from) {
    conditions.push(
      gte(sparks.createdAt, new Date(`${filters.from}T00:00:00.000Z`)),
    );
  }

  if (filters.to) {
    conditions.push(
      lte(sparks.createdAt, new Date(`${filters.to}T23:59:59.999Z`)),
    );
  }

  const tagIds = normalizeTagIds(filters.tag_id);
  if (tagIds.length > 0) {
    conditions.push(
      inArray(
        sparks.id,
        db
          .select({ id: sparkTags.sparkId })
          .from(sparkTags)
          .where(inArray(sparkTags.tagId, tagIds)),
      ),
    );
  }

  const where = and(...conditions);
  const { page, pageSize } = parsePagination(filters);

  const query = db
    .select()
    .from(sparks)
    .where(where)
    .orderBy(desc(sparks.updatedAt), desc(sparks.createdAt), desc(sparks.id));

  const [rows, totalRows] = await Promise.all([
    page === null ? query : query.limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(sparks).where(where),
  ]);
  const total = totalRows[0]?.value ?? 0;

  const tagsBySparkId = await loadTagsBySparkIds(
    db,
    rows.map((row) => row.id),
    userId,
  );
  const attachmentsBySparkId = await loadAttachmentsByOwnerIds(
    db,
    "spark",
    rows.map((row) => row.id),
    userId,
  );

  return c.json({
    sparks: rows.map((spark) =>
      toSparkResponse(
        spark,
        tagsBySparkId.get(spark.id) ?? [],
        attachmentsBySparkId.get(spark.id) ?? [],
      ),
    ),
    pagination: buildPaginationMeta(total, page, pageSize),
  });
};

const createSparkHandler = async (
  c: Context<AppEnv, "/", JsonInput<CreateSparkInput>>,
) => {
  const userId = c.get("userId");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const tagIds = [...new Set(input.tag_ids ?? [])];
  if (!(await validateTagOwnership(db, tagIds, userId))) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const sparkId = nanoid();
  const now = new Date();

  const insertSpark = db.insert(sparks).values({
    id: sparkId,
    userId,
    content: input.content,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
  const insertTags = tagIds.map((tagId) =>
    db.insert(sparkTags).values({ sparkId, tagId }),
  );

  const statements: BatchItem<"sqlite">[] = [insertSpark, ...insertTags];
  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  const [created] = await db
    .select()
    .from(sparks)
    .where(and(eq(sparks.id, sparkId), eq(sparks.userId, userId)))
    .limit(1);
  const createdTags = await loadTagsForSpark(db, created.id, userId);

  return c.json({ spark: toSparkResponse(created, createdTags, []) }, 201);
};

const randomSparkHandler = async (c: Context<AppEnv, "/random">) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const [spark] = await db
    .select()
    .from(sparks)
    .where(and(eq(sparks.userId, userId), eq(sparks.status, "open")))
    .orderBy(sql`RANDOM()`)
    .limit(1);

  if (!spark) {
    return c.json({ error: "No sparks to recall" }, 404);
  }

  const sparkTagList = await loadTagsForSpark(db, spark.id, userId);
  const attachmentRows = await loadAttachments(db, "spark", spark.id, userId);
  return c.json({
    spark: toSparkResponse(spark, sparkTagList, attachmentRows),
  });
};

const getSpark = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const spark = await findOwnedSpark(db, id, userId);
  if (!spark) {
    return c.json({ error: "Spark not found" }, 404);
  }

  const sparkTagList = await loadTagsForSpark(db, spark.id, userId);
  const attachmentRows = await loadAttachments(db, "spark", spark.id, userId);
  return c.json({
    spark: toSparkResponse(spark, sparkTagList, attachmentRows),
  });
};

const updateSparkHandler = async (
  c: Context<AppEnv, "/:id", JsonInput<UpdateSparkInput>>,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = createDb(c.env.DB);

  const owned = await findOwnedSpark(db, id, userId);
  if (!owned) {
    return c.json({ error: "Spark not found" }, 404);
  }

  const hasTagIds = input.tag_ids !== undefined;
  const tagIds = [...new Set(input.tag_ids ?? [])];
  if (hasTagIds && !(await validateTagOwnership(db, tagIds, userId))) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const updates: Partial<SparkRow> = { updatedAt: new Date() };
  if (input.content !== undefined) updates.content = input.content;
  if (input.status !== undefined) updates.status = input.status;

  const statements: BatchItem<"sqlite">[] = [
    db
      .update(sparks)
      .set(updates)
      .where(and(eq(sparks.id, id), eq(sparks.userId, userId))),
  ];
  if (hasTagIds) {
    statements.push(db.delete(sparkTags).where(eq(sparkTags.sparkId, id)));
    statements.push(
      ...tagIds.map((tagId) =>
        db.insert(sparkTags).values({ sparkId: id, tagId }),
      ),
    );
  }

  await db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  const [updated] = await db
    .select()
    .from(sparks)
    .where(and(eq(sparks.id, id), eq(sparks.userId, userId)))
    .limit(1);
  const updatedTags = await loadTagsForSpark(db, updated.id, userId);
  const attachmentRows = await loadAttachments(db, "spark", updated.id, userId);

  return c.json({
    spark: toSparkResponse(updated, updatedTags, attachmentRows),
  });
};

const deleteSparkHandler = async (c: Context<AppEnv, "/:id">) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const owned = await findOwnedSpark(db, id, userId);
  if (!owned) {
    return c.json({ error: "Spark not found" }, 404);
  }

  await deleteOwnedAttachments(db, c.env.STORAGE, "spark", id, userId);
  await db
    .delete(sparks)
    .where(and(eq(sparks.id, id), eq(sparks.userId, userId)));

  return c.json({ success: true });
};

const uploadSparkAttachmentHandler = async (
  c: Context<AppEnv, "/:id/attachments">,
) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const spark = await findOwnedSpark(db, id, userId);
  if (!spark) {
    return c.json({ error: "Spark not found" }, 404);
  }

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  try {
    const row = await createAttachment(db, c.env.STORAGE, {
      ownerType: "spark",
      ownerId: id,
      userId,
      file,
    });
    return c.json({ attachment: toAttachmentResponse(row) }, 201);
  } catch (error) {
    if (error instanceof AttachmentUploadError) {
      return c.json({ error: error.error.message }, 400);
    }
    throw error;
  }
};

export const sparksRoute = new Hono<AppEnv>()
  .get("/", zValidator("query", sparkFilterSchema), listSparks)
  .post("/", zValidator("json", createSparkSchema), createSparkHandler)
  .get("/random", randomSparkHandler)
  .get("/:id", getSpark)
  .put("/:id", zValidator("json", updateSparkSchema), updateSparkHandler)
  .delete("/:id", deleteSparkHandler)
  .post("/:id/attachments", uploadSparkAttachmentHandler);
