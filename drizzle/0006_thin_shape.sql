PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_brag_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`title` text NOT NULL,
	`situation` text NOT NULL,
	`task` text NOT NULL,
	`action` text NOT NULL,
	`result` text NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_brag_logs`("id", "user_id", "workspace_id", "title", "situation", "task", "action", "result", "occurred_at", "created_at", "updated_at") SELECT "id", "user_id", "workspace_id", "title", "situation", "task", "action", "result", "occurred_at", "created_at", "updated_at" FROM `brag_logs`;--> statement-breakpoint
DROP TABLE `brag_logs`;--> statement-breakpoint
ALTER TABLE `__new_brag_logs` RENAME TO `brag_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `brag_logs_user_id_workspace_id_idx` ON `brag_logs` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `brag_logs_user_id_occurred_at_idx` ON `brag_logs` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `__new_learning_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_learning_notes`("id", "user_id", "workspace_id", "title", "content", "created_at", "updated_at") SELECT "id", "user_id", "workspace_id", "title", "content", "created_at", "updated_at" FROM `learning_notes`;--> statement-breakpoint
DROP TABLE `learning_notes`;--> statement-breakpoint
ALTER TABLE `__new_learning_notes` RENAME TO `learning_notes`;--> statement-breakpoint
CREATE INDEX `learning_notes_user_id_workspace_id_idx` ON `learning_notes` (`user_id`,`workspace_id`);