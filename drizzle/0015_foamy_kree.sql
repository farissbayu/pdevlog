CREATE TABLE `project_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'feat' NOT NULL,
	`status` text DEFAULT 'backlog' NOT NULL,
	`target_version` text DEFAULT 'Next' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`shipped_at` integer,
	`shipped_version` text,
	`brag_log_id` text,
	`note_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brag_log_id`) REFERENCES `brag_logs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_items_user_id_project_id_idx` ON `project_items` (`user_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `project_items_project_id_status_idx` ON `project_items` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `project_items_project_id_target_version_idx` ON `project_items` (`project_id`,`target_version`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`description` text,
	`repo_url` text,
	`live_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_user_id_workspace_id_idx` ON `projects` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `projects_user_id_status_idx` ON `projects` (`user_id`,`status`);