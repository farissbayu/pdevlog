import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";

import { bulletLine } from "@/shared/format/bullets";
import {
  exportLogsQuerySchema,
  type ExportLogsQuery,
} from "@/shared/schemas/settings";
import { createDb, type Database } from "@/worker/db";
import { bragLogs, workspaces, type TagRow } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { loadTagsByOwnerIds } from "@/worker/features/tags/helpers";

type QueryInput<T> = { in: { query: T }; out: { query: T } };

const EMPTY_VALUE = "—";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTagNames(logTags: TagRow[]): string {
  if (logTags.length === 0) {
    return EMPTY_VALUE;
  }
  return logTags.map((tag) => tag.name).join(", ");
}

async function loadExportRows(
  db: Database,
  userId: string,
  from?: string,
  to?: string,
) {
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
    .leftJoin(
      workspaces,
      and(
        eq(bragLogs.workspaceId, workspaces.id),
        eq(workspaces.userId, userId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(bragLogs.occurredAt), desc(bragLogs.createdAt));

  const tagsByLogId = await loadTagsByOwnerIds(
    db,
    "brag-log",
    rows.map((row) => row.log.id),
    userId,
  );

  return { rows, tagsByLogId };
}

type ExportData = Awaited<ReturnType<typeof loadExportRows>>;

function renderStarExport(
  { rows, tagsByLogId }: ExportData,
  from?: string,
  to?: string,
): string {
  const lines: string[] = [];
  lines.push("# Brag Logs");
  lines.push("");
  lines.push(
    `> Exported from Personal Dev Log on ${today()}`,
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

  return lines.join("\n");
}

function renderBulletsExport(
  { rows, tagsByLogId }: ExportData,
  from?: string,
  to?: string,
): string {
  const lines: string[] = [];
  lines.push("# Brag Log Bullets");
  lines.push("");
  lines.push(`> Exported from Personal Dev Log on ${today()}`);
  lines.push(
    `> ${rows.length} entries · ${from ?? "beginning"} → ${to ?? "today"}`,
  );
  lines.push("");

  if (rows.length === 0) {
    lines.push("_No brag logs found for the selected range._");
    lines.push("");
  } else {
    for (const { log } of rows) {
      lines.push(
        bulletLine(
          log,
          (tagsByLogId.get(log.id) ?? []).map((tag) => tag.name),
        ),
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

const exportBragLogs = async (
  c: Context<AppEnv, "/brag-logs", QueryInput<ExportLogsQuery>>,
) => {
  const userId = c.get("userId");
  const { from, to } = c.req.valid("query");
  const format = c.req.valid("query").format ?? "star";
  const db = createDb(c.env.DB);

  const data = await loadExportRows(db, userId, from, to);
  const markdown =
    format === "bullets"
      ? renderBulletsExport(data, from, to)
      : renderStarExport(data, from, to);
  const filename =
    format === "bullets" ? "brag-log-bullets.md" : "brag-logs.md";

  return c.body(markdown, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
};

export const exportRoute = new Hono<AppEnv>().get(
  "/brag-logs",
  zValidator("query", exportLogsQuerySchema),
  exportBragLogs,
);
