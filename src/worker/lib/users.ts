import { eq } from "drizzle-orm";

import type { Database } from "@/worker/db";
import { users } from "@/worker/db/schema";

export function parseAdminEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(
  email: string,
  allowlist: string | undefined,
): boolean {
  return parseAdminEmails(allowlist).has(email.trim().toLowerCase());
}

export async function deleteUserData(
  db: Database,
  storage: R2Bucket,
  userId: string,
): Promise<void> {
  const prefix = `attachments/${userId}/`;
  let cursor: string | undefined;
  do {
    const listed = await storage.list({ prefix, cursor });
    if (listed.objects.length > 0) {
      await storage.delete(listed.objects.map((object) => object.key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  await db.delete(users).where(eq(users.id, userId));
}
