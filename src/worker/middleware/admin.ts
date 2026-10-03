import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";

import { createDb } from "@/worker/db";
import { users } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { isAdminEmail } from "@/worker/lib/users";

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !isAdminEmail(user.email, c.env.ADMIN_EMAILS)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return next();
};
