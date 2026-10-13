import { and, eq, inArray } from "drizzle-orm";

import type { TagResponse } from "@/shared/schemas/tag";
import type { Database } from "@/worker/db";
import {
  bragTags,
  noteTags,
  sparkTags,
  tags,
  type TagRow,
} from "@/worker/db/schema";

export type TagOwnerType = "brag-log" | "note" | "spark";

const pivotByOwner = {
  "brag-log": { pivot: bragTags, ownerKey: bragTags.bragLogId, tagKey: bragTags.tagId },
  note: { pivot: noteTags, ownerKey: noteTags.noteId, tagKey: noteTags.tagId },
  spark: { pivot: sparkTags, ownerKey: sparkTags.sparkId, tagKey: sparkTags.tagId },
} as const;

export function toTagResponse(tag: TagRow): TagResponse {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: new Date(tag.createdAt).toISOString(),
  };
}

export async function validateTagOwnership(
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

export async function loadTagsForOwner(
  db: Database,
  ownerType: TagOwnerType,
  ownerId: string,
  userId: string,
): Promise<TagRow[]> {
  const { pivot, ownerKey, tagKey } = pivotByOwner[ownerType];
  const rows = await db
    .select({ tag: tags })
    .from(pivot)
    .innerJoin(tags, eq(tagKey, tags.id))
    .where(and(eq(ownerKey, ownerId), eq(tags.userId, userId)));
  return rows.map((row) => row.tag);
}

export async function loadTagsByOwnerIds(
  db: Database,
  ownerType: TagOwnerType,
  ownerIds: string[],
  userId: string,
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (ownerIds.length === 0) {
    return map;
  }

  const { pivot, ownerKey, tagKey } = pivotByOwner[ownerType];
  const rows = await db
    .select({ ownerId: ownerKey, tag: tags })
    .from(pivot)
    .innerJoin(tags, eq(tagKey, tags.id))
    .where(and(inArray(ownerKey, ownerIds), eq(tags.userId, userId)));

  for (const row of rows) {
    const list = map.get(row.ownerId) ?? [];
    list.push(row.tag);
    map.set(row.ownerId, list);
  }
  return map;
}
