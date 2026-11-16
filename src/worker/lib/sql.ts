import { sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * Case-insensitive substring match that treats "%" and "_" as literal text.
 * Plain LIKE would let a search for "100%" match every value starting with 100.
 */
export function containsText(column: AnySQLiteColumn, value: string): SQL {
  const escaped = value.replace(/[\\%_]/g, (char) => `\\${char}`);
  return sql`lower(${column}) like lower(${`%${escaped}%`}) escape '\\'`;
}
