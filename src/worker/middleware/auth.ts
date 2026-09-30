import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "@/worker/env";
import { getSessionUserId } from "@/worker/features/auth/session";

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.path.startsWith("/api/auth/")) {
    return next();
  }

  const userId = await getSessionUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", userId);
  return next();
};
