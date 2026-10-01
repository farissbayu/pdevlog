import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";

import {
  exportLogsQuerySchema,
  type ExportLogsQuery,
} from "@/shared/schemas/settings";
import { createDb, type Database } from "@/worker/db";
import {
  bragLogs,
  bragTags,
  tags,
  workspaces,
  type TagRow,
} from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

type QueryInput<T> = { in: { query: T }; out: { query: T } };

const EMPTY_VALUE = "—";

async function loadTagsByLogIds(
  db: Database,
  logIds: string[],
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (logIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({ bragLogId: bragTags.bragLogId, tag: tags })
    .from(bragTags)
    .innerJoin(tags, eq(bragTags.tagId, tags.id))
    .where(inArray(bragTags.bragLogId, logIds));

  for (const row of rows) {
    const list = map.get(row.bragLogId) ?? [];
    list.push(row.tag);
    map.set(row.bragLogId, list);
  }
  return map;
}

function formatTagNames(logTags: TagRow[]): string {
  if (logTags.length === 0) {
    return EMPTY_VALUE;
  }
  return logTags.map((tag) => tag.name).join(", ");
}

const exportBragLogs = async (
  c: Context<AppEnv, "/brag-logs", QueryInput<ExportLogsQuery>>,
) => {
  const userId = c.get("userId");
  const { from, to } = c.req.valid("query");
  const db = createDb(c.env.DB);

  const conditions: SQL[] = [eq(bragLogs.userId, userId)];
  if (from) {
    conditions.push(gte(bragLogs.occurredAt, from));
  }
  if (to) {
    conditions.push(lte(bragLogs.occurredAt, to));
  }

  const rows = await db
    .select({ log: bragLogs, workspace: workspaces })
    .from(bragLogs)
    .leftJoin(workspaces, eq(bragLogs.workspaceId, workspaces.id))
    .where(and(...conditions))
    .orderBy(desc(bragLogs.occurredAt), desc(bragLogs.createdAt));

  const tagsByLogId = await loadTagsByLogIds(
    db,
    rows.map((row) => row.log.id),
  );

  const lines: string[] = [];
  lines.push("# Brag Logs");
  lines.push("");
  lines.push(
    `> Exported from Personal Dev OS on ${new Date().toISOString().slice(0, 10)}`,
  );
  if (from || to) {
    lines.push(
      `> Date range: ${from ?? "beginning"} to ${to ?? "today"}`,
    );
  }
  lines.push("");
  lines.push(`Total logs: ${rows.length}`);
  lines.push("");

  if (rows.length === 0) {
    lines.push("_No brag logs found for the selected range._");
    lines.push("");
  } else {
    for (const { log, workspace } of rows) {
      lines.push("---");
      lines.push("");
      lines.push(`## ${log.title}`);
      lines.push("");
      lines.push(`- **Date:** ${log.occurredAt}`);
      lines.push(
        `- **Workspace:** ${workspace ? workspace.name : EMPTY_VALUE}`,
      );
      lines.push(
        `- **Tags:** ${formatTagNames(tagsByLogId.get(log.id) ?? [])}`,
      );
      lines.push("");
      lines.push("### Situation");
      lines.push("");
      lines.push(log.situation);
      lines.push("");
      lines.push("### Task");
      lines.push("");
      lines.push(log.task);
      lines.push("");
      lines.push("### Action");
      lines.push("");
      lines.push(log.action);
      lines.push("");
      lines.push("### Result");
      lines.push("");
      lines.push(log.result);
      lines.push("");
    }
  }

  const markdown = lines.join("\n");

  return c.body(markdown, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": 'attachment; filename="brag-logs.md"',
  });
};

export const exportRoute = new Hono<AppEnv>().get(
  "/brag-logs",
  zValidator("query", exportLogsQuerySchema),
  exportBragLogs,
);
