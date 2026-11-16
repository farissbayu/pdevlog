import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "@/worker/db";
import {
  sources,
  type SourceOwnerType,
  type SourceRow,
} from "@/worker/db/schema";

export async function loadSources(
  db: Database,
  ownerType: SourceOwnerType,
  ownerId: string,
  userId: string,
): Promise<SourceRow[]> {
  return db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.ownerType, ownerType),
        eq(sources.ownerId, ownerId),
        eq(sources.userId, userId),
      ),
    )
    .orderBy(asc(sources.position), asc(sources.createdAt));
}

export async function loadSourcesByOwnerIds(
  db: Database,
  ownerType: SourceOwnerType,
  ownerIds: string[],
  userId: string,
): Promise<Map<string, SourceRow[]>> {
  const map = new Map<string, SourceRow[]>();
  if (ownerIds.length === 0) {
    return map;
  }

  const rows = await db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.ownerType, ownerType),
        inArray(sources.ownerId, ownerIds),
        eq(sources.userId, userId),
      ),
    )
    .orderBy(asc(sources.position), asc(sources.createdAt));

  for (const row of rows) {
    const list = map.get(row.ownerId) ?? [];
    list.push(row);
    map.set(row.ownerId, list);
  }
  return map;
}
