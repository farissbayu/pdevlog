import { zValidator } from "@hono/zod-validator";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  sum,
  type SQL,
} from "drizzle-orm";
import { Hono, type Context } from "hono";

import {
  adminUserFilterSchema,
  type AdminUser,
  type AdminUserFilterInput,
  type AdminUserListResponse,
  type AdminUserUsage,
} from "@/shared/schemas/admin";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/shared/schemas/pagination";
import { createDb, type Database } from "@/worker/db";
import {
  aiUsage,
  attachments,
  bragLogs,
  notes,
  sparks,
  users,
  workspaces,
  type UserRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { deleteUserData, isAdminEmail } from "@/worker/lib/users";
import { requireAdmin } from "@/worker/middleware/admin";

type QueryInput<T> = { in: { query: T }; out: { query: T } };

const EMPTY_USAGE: AdminUserUsage = {
  workspaces: 0,
  bragLogs: 0,
  notes: 0,
  sparks: 0,
  attachments: 0,
  storageBytes: 0,
  aiCalls: 0,
  aiTokens: 0,
};

async function loadUsage(
  db: Database,
  userIds: string[],
): Promise<Map<string, AdminUserUsage>> {
  const map = new Map<string, AdminUserUsage>();
  if (userIds.length === 0) {
    return map;
  }

  const [
    workspaceRows,
    bragLogRows,
    noteRows,
    sparkRows,
    attachmentRows,
    aiRows,
  ] = await Promise.all([
    db
      .select({ userId: workspaces.userId, value: count() })
      .from(workspaces)
      .where(inArray(workspaces.userId, userIds))
      .groupBy(workspaces.userId),
    db
      .select({ userId: bragLogs.userId, value: count() })
      .from(bragLogs)
      .where(inArray(bragLogs.userId, userIds))
      .groupBy(bragLogs.userId),
    db
      .select({ userId: notes.userId, value: count() })
      .from(notes)
      .where(inArray(notes.userId, userIds))
      .groupBy(notes.userId),
    db
      .select({ userId: sparks.userId, value: count() })
      .from(sparks)
      .where(inArray(sparks.userId, userIds))
      .groupBy(sparks.userId),
    db
      .select({
        userId: attachments.userId,
        value: count(),
        bytes: sum(attachments.size),
      })
      .from(attachments)
      .where(inArray(attachments.userId, userIds))
      .groupBy(attachments.userId),
    db
      .select({
        userId: aiUsage.userId,
        calls: count(),
        tokens: sum(aiUsage.totalTokens),
      })
      .from(aiUsage)
      .where(inArray(aiUsage.userId, userIds))
      .groupBy(aiUsage.userId),
  ]);

  for (const id of userIds) {
    map.set(id, { ...EMPTY_USAGE });
  }
  for (const row of workspaceRows) {
    map.get(row.userId)!.workspaces = row.value;
  }
  for (const row of bragLogRows) {
    map.get(row.userId)!.bragLogs = row.value;
  }
  for (const row of noteRows) {
    map.get(row.userId)!.notes = row.value;
  }
  for (const row of sparkRows) {
    map.get(row.userId)!.sparks = row.value;
  }
  for (const row of attachmentRows) {
    map.get(row.userId)!.attachments = row.value;
    map.get(row.userId)!.storageBytes = Number(row.bytes ?? 0);
  }
  for (const row of aiRows) {
    map.get(row.userId)!.aiCalls = row.calls;
    map.get(row.userId)!.aiTokens = Number(row.tokens ?? 0);
  }

  return map;
}

function toAdminUser(
  user: UserRow,
  usage: AdminUserUsage,
  adminEmails: string | undefined,
): AdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin: isAdminEmail(user.email, adminEmails),
    createdAt: new Date(user.createdAt).toISOString(),
    usage,
  };
}

const listUsers = async (
  c: Context<AppEnv, "/", QueryInput<AdminUserFilterInput>>,
) => {
  const filters = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [];
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(like(users.name, pattern), like(users.email, pattern));
    if (search) {
      conditions.push(search);
    }
  }
  const where = and(...conditions);

  const { page, pageSize } = parsePagination(filters);

  const [totalRow] = await db
    .select({ value: count() })
    .from(users)
    .where(where);
  const total = totalRow?.value ?? 0;

  const query = db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id));

  const rows =
    page === null
      ? await query
      : await query.limit(pageSize).offset((page - 1) * pageSize);

  const usageByUserId = await loadUsage(
    db,
    rows.map((row) => row.id),
  );

  const response: AdminUserListResponse = {
    users: rows.map((row) =>
      toAdminUser(
        row,
        usageByUserId.get(row.id) ?? { ...EMPTY_USAGE },
        c.env.ADMIN_EMAILS,
      ),
    ),
    pagination: buildPaginationMeta(total, page, pageSize),
  };

  return c.json(response);
};

const deleteUser = async (c: Context<AppEnv, "/:id">) => {
  const adminId = c.get("userId");
  const targetId = c.req.param("id");

  if (targetId === adminId) {
    return c.json({ error: "You cannot delete your own account" }, 400);
  }

  const db = createDb(c.env.DB);
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!target) {
    return c.json({ error: "User not found" }, 404);
  }

  await deleteUserData(db, c.env.STORAGE, targetId);

  return c.json({ success: true });
};

export const adminRoute = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/users", zValidator("query", adminUserFilterSchema), listUsers)
  .delete("/users/:id", deleteUser);
