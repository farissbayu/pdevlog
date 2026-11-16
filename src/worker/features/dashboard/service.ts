import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import type { CheckInDay } from "@/shared/schemas/check-in";
import type { Database } from "@/worker/db";
import { bragLogs, notes, projectItems, sparks } from "@/worker/db/schema";

type SourceCounts = Omit<CheckInDay, "date" | "total">;

function tzModifier(tzOffsetMinutes: number): string {
  const sign = tzOffsetMinutes >= 0 ? "+" : "-";
  return `${sign}${Math.abs(tzOffsetMinutes)} minutes`;
}

export function localDayKey(
  timestampMs: number,
  tzOffsetMinutes: number,
): string {
  return new Date(timestampMs + tzOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

export async function loadActiveDays(
  db: Database,
  userId: string,
  tzOffsetMinutes: number,
): Promise<CheckInDay[]> {
  const modifier = tzModifier(tzOffsetMinutes);
  const dayExpr = (column: AnySQLiteColumn) =>
    sql<string>`date(${column} / 1000, 'unixepoch', ${modifier})`;

  const [bragRows, noteRows, sparkRows, itemRows] = await Promise.all([
    db
      .select({ day: dayExpr(bragLogs.createdAt), value: count() })
      .from(bragLogs)
      .where(eq(bragLogs.userId, userId))
      .groupBy(dayExpr(bragLogs.createdAt)),
    db
      .select({ day: dayExpr(notes.createdAt), value: count() })
      .from(notes)
      .where(eq(notes.userId, userId))
      .groupBy(dayExpr(notes.createdAt)),
    db
      .select({ day: dayExpr(sparks.createdAt), value: count() })
      .from(sparks)
      .where(eq(sparks.userId, userId))
      .groupBy(dayExpr(sparks.createdAt)),
    db
      .select({ day: dayExpr(projectItems.shippedAt), value: count() })
      .from(projectItems)
      .where(
        and(
          eq(projectItems.userId, userId),
          eq(projectItems.status, "shipped"),
          isNotNull(projectItems.shippedAt),
        ),
      )
      .groupBy(dayExpr(projectItems.shippedAt)),
  ]);

  const byDay = new Map<string, SourceCounts>();
  const addCounts = (
    rows: { day: string; value: number }[],
    key: keyof SourceCounts,
  ) => {
    for (const row of rows) {
      const counts = byDay.get(row.day) ?? {
        bragLogs: 0,
        notes: 0,
        sparks: 0,
        projectItems: 0,
      };
      counts[key] = row.value;
      byDay.set(row.day, counts);
    }
  };
  addCounts(bragRows, "bragLogs");
  addCounts(noteRows, "notes");
  addCounts(sparkRows, "sparks");
  addCounts(itemRows, "projectItems");

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      total:
        counts.bragLogs + counts.notes + counts.sparks + counts.projectItems,
      ...counts,
    }));
}
