CREATE TABLE `brag_logs` (
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
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `brag_logs_user_id_workspace_id_idx` ON `brag_logs` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `brag_logs_user_id_occurred_at_idx` ON `brag_logs` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `brag_tags` (
	`brag_log_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`brag_log_id`, `tag_id`),
	FOREIGN KEY (`brag_log_id`) REFERENCES `brag_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
