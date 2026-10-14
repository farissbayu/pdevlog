import { eq } from "drizzle-orm";

import type { UserResponse } from "@/shared/schemas/auth";
import type { Database } from "@/worker/db";
import { users, type UserRow } from "@/worker/db/schema";

export function toUserResponse(user: UserRow, isAdmin: boolean): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

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
