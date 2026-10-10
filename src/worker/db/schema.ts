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
  "project-item",
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

export const skillShredStatuses = [
  "draft",
  "spike_done",
  "building",
  "completed",
  "archived",
] as const;

export type SkillShredStatus = (typeof skillShredStatuses)[number];

export const skillShreds = sqliteTable(
  "skill_shreds",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    currentContext: text("current_context"),
    targetTimeMinutes: integer("target_time_minutes").notNull().default(60),
    toyProjectTitle: text("toy_project_title").notNull(),
    blueprintJson: text("blueprint_json").notNull(),
    status: text("status", { enum: skillShredStatuses })
      .notNull()
      .default("draft"),
    spikeCompletedAt: integer("spike_completed_at", { mode: "timestamp_ms" }),
    completedStepsJson: text("completed_steps_json").notNull().default("[]"),
    challengeCompletedAt: integer("challenge_completed_at", {
      mode: "timestamp_ms",
    }),
    noteId: text("note_id").references(() => notes.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("skill_shreds_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("skill_shreds_status_idx").on(table.userId, table.status),
  ],
);

export const projectStatuses = ["active", "maintenance", "archived"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    repoUrl: text("repo_url"),
    liveUrl: text("live_url"),
    status: text("status", { enum: projectStatuses })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("projects_user_id_workspace_id_idx").on(
      table.userId,
      table.workspaceId,
    ),
    index("projects_user_id_status_idx").on(table.userId, table.status),
  ],
);

export const projectItemKinds = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "spike",
  "docs",
] as const;

export type ProjectItemKind = (typeof projectItemKinds)[number];

export const projectItemStatuses = [
  "backlog",
  "in_progress",
  "shipped",
  "dropped",
] as const;

export type ProjectItemStatus = (typeof projectItemStatuses)[number];

export const projectItems = sqliteTable(
  "project_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind", { enum: projectItemKinds }).notNull().default("feat"),
    status: text("status", { enum: projectItemStatuses })
      .notNull()
      .default("backlog"),
    targetVersion: text("target_version").notNull().default("Next"),
    position: integer("position").notNull().default(0),
    shippedAt: integer("shipped_at", { mode: "timestamp_ms" }),
    shippedVersion: text("shipped_version"),
    bragLogId: text("brag_log_id").references(() => bragLogs.id, {
      onDelete: "set null",
    }),
    noteId: text("note_id").references(() => notes.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("project_items_user_id_project_id_idx").on(
      table.userId,
      table.projectId,
    ),
    index("project_items_project_id_status_idx").on(
      table.projectId,
      table.status,
    ),
    index("project_items_project_id_target_version_idx").on(
      table.projectId,
      table.targetVersion,
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
export type SkillShredRow = typeof skillShreds.$inferSelect;
export type NewSkillShredRow = typeof skillShreds.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ProjectItemRow = typeof projectItems.$inferSelect;
export type NewProjectItemRow = typeof projectItems.$inferInsert;
