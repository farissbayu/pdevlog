import { sql } from "drizzle-orm";
import {
  index,
  primaryKey,
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  googleSub: text("google_sub").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const workspaceTypes = ["work", "learning", "general"] as const;

export type WorkspaceType = (typeof workspaceTypes)[number];

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type", { enum: workspaceTypes }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("workspaces_user_id_idx").on(table.userId)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("tags_user_id_name_unique").on(table.userId, table.name),
  ],
);

export const bragLogs = sqliteTable(
  "brag_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    situation: text("situation").notNull(),
    task: text("task").notNull(),
    action: text("action").notNull(),
    result: text("result").notNull(),
    occurredAt: text("occurred_at").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("brag_logs_user_id_workspace_id_idx").on(
      table.userId,
      table.workspaceId,
    ),
    index("brag_logs_user_id_occurred_at_idx").on(
      table.userId,
      table.occurredAt,
    ),
  ],
);

export const bragTags = sqliteTable(
  "brag_tags",
  {
    bragLogId: text("brag_log_id")
      .notNull()
      .references(() => bragLogs.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.bragLogId, table.tagId] })],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("notes_user_id_workspace_id_idx").on(
      table.userId,
      table.workspaceId,
    ),
  ],
);

export const noteTags = sqliteTable(
  "note_tags",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.noteId, table.tagId] })],
);

export const sourceOwnerTypes = ["workspace", "note"] as const;

export type SourceOwnerType = (typeof sourceOwnerTypes)[number];

export const sourceKinds = [
  "video",
  "course",
  "book",
  "article",
  "link",
  "other",
] as const;

export type SourceKind = (typeof sourceKinds)[number];

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ownerType: text("owner_type", { enum: sourceOwnerTypes }).notNull(),
    ownerId: text("owner_id").notNull(),
    url: text("url"),
    label: text("label"),
    kind: text("kind", { enum: sourceKinds }),
    locator: text("locator"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("sources_owner_idx").on(table.ownerType, table.ownerId),
    index("sources_user_id_idx").on(table.userId),
  ],
);

export const sparkStatuses = ["open", "archived", "promoted"] as const;

export type SparkStatus = (typeof sparkStatuses)[number];

export const sparkPromotionTypes = [
  "brag-log",
  "note",
  "workspace",
] as const;

export type SparkPromotionType = (typeof sparkPromotionTypes)[number];

export const sparks = sqliteTable(
  "sparks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: text("status", { enum: sparkStatuses })
      .notNull()
      .default("open"),
    promotedType: text("promoted_type", { enum: sparkPromotionTypes }),
    promotedId: text("promoted_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("sparks_user_id_status_created_at_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const sparkTags = sqliteTable(
  "spark_tags",
  {
    sparkId: text("spark_id")
      .notNull()
      .references(() => sparks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.sparkId, table.tagId] })],
);

export const attachmentOwnerTypes = [
  "spark",
  "note",
  "brag-log",
] as const;

export type AttachmentOwnerType = (typeof attachmentOwnerTypes)[number];

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ownerType: text("owner_type", { enum: attachmentOwnerTypes }).notNull(),
    ownerId: text("owner_id").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("attachments_owner_idx").on(table.ownerType, table.ownerId),
    index("attachments_user_id_idx").on(table.userId),
  ],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("ai_usage_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type NewWorkspaceRow = typeof workspaces.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;
export type BragLogRow = typeof bragLogs.$inferSelect;
export type NewBragLogRow = typeof bragLogs.$inferInsert;
export type BragTagRow = typeof bragTags.$inferSelect;
export type NewBragTagRow = typeof bragTags.$inferInsert;
export type NoteRow = typeof notes.$inferSelect;
export type NewNoteRow = typeof notes.$inferInsert;
export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;
export type NoteTagRow = typeof noteTags.$inferSelect;
export type NewNoteTagRow = typeof noteTags.$inferInsert;
export type SparkRow = typeof sparks.$inferSelect;
export type NewSparkRow = typeof sparks.$inferInsert;
export type SparkTagRow = typeof sparkTags.$inferSelect;
export type NewSparkTagRow = typeof sparkTags.$inferInsert;
export type AttachmentRow = typeof attachments.$inferSelect;
export type NewAttachmentRow = typeof attachments.$inferInsert;
export type AiUsageRow = typeof aiUsage.$inferSelect;
export type NewAiUsageRow = typeof aiUsage.$inferInsert;
