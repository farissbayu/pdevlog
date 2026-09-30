import { Hono } from "hono";

import type { AppEnv } from "@/worker/env";
import { authRoute } from "@/worker/features/auth/route";
import { tagsRoute } from "@/worker/features/tags/route";
import { workspacesRoute } from "@/worker/features/workspaces/route";
import { authMiddleware } from "@/worker/middleware/auth";

const app = new Hono<AppEnv>()
  .use("/api/*", authMiddleware)
  .route("/api/auth", authRoute)
  .route("/api/workspaces", workspacesRoute)
  .route("/api/tags", tagsRoute)
  .get("/api/health", (c) => c.json({ status: "ok" }))
  .notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.text("Not found", 404);
  })
  .onError((error, c) => {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  });

export type AppType = typeof app;

export default app;
