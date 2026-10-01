CREATE TABLE `learning_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `learning_notes_user_id_workspace_id_idx` ON `learning_notes` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `note_tags` (
	`learning_note_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`learning_note_id`, `tag_id`),
	FOREIGN KEY (`learning_note_id`) REFERENCES `learning_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
