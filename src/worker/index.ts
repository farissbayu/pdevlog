import { Hono } from "hono";

import type { AppEnv } from "@/worker/env";
import { attachmentsRoute } from "@/worker/features/attachments/route";
import { authRoute } from "@/worker/features/auth/route";
import { bragLogsRoute } from "@/worker/features/brag-logs/route";
import { dashboardRoute } from "@/worker/features/dashboard/route";
import { exportRoute } from "@/worker/features/export/route";
import { learningNotesRoute } from "@/worker/features/learning-notes/route";
import { sparksRoute } from "@/worker/features/sparks/route";
import { tagsRoute } from "@/worker/features/tags/route";
import { workspacesRoute } from "@/worker/features/workspaces/route";
import { authMiddleware } from "@/worker/middleware/auth";

const app = new Hono<AppEnv>()
  .use("/api/*", authMiddleware)
  .route("/api/auth", authRoute)
  .route("/api/workspaces", workspacesRoute)
  .route("/api/tags", tagsRoute)
  .route("/api/brag-logs", bragLogsRoute)
  .route("/api/learning-notes", learningNotesRoute)
  .route("/api/sparks/attachments", attachmentsRoute)
  .route("/api/sparks", sparksRoute)
  .route("/api/dashboard", dashboardRoute)
  .route("/api/export", exportRoute)
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
