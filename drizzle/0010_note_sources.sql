CREATE TABLE `note_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_sources_note_id_idx` ON `note_sources` (`note_id`);