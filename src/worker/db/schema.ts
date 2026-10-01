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

export const workspaceTypes = ["work", "learning"] as const;

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

export const learningNotes = sqliteTable(
  "learning_notes",
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
    index("learning_notes_user_id_workspace_id_idx").on(
      table.userId,
      table.workspaceId,
    ),
  ],
);

export const noteTags = sqliteTable(
  "note_tags",
  {
    learningNoteId: text("learning_note_id")
      .notNull()
      .references(() => learningNotes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.learningNoteId, table.tagId] })],
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
export type LearningNoteRow = typeof learningNotes.$inferSelect;
export type NewLearningNoteRow = typeof learningNotes.$inferInsert;
export type NoteTagRow = typeof noteTags.$inferSelect;
export type NewNoteTagRow = typeof noteTags.$inferInsert;
