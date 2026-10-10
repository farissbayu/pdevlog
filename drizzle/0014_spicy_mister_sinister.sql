CREATE TABLE `skill_shreds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`current_context` text,
	`target_time_minutes` integer DEFAULT 60 NOT NULL,
	`toy_project_title` text NOT NULL,
	`blueprint_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`spike_completed_at` integer,
	`completed_steps_json` text DEFAULT '[]' NOT NULL,
	`challenge_completed_at` integer,
	`note_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `skill_shreds_user_id_created_at_idx` ON `skill_shreds` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `skill_shreds_status_idx` ON `skill_shreds` (`user_id`,`status`);