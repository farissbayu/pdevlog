PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_skill_shreds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`current_context` text,
	`target_time_minutes` integer DEFAULT 60 NOT NULL,
	`toy_project_title` text,
	`blueprint_json` text,
	`status` text DEFAULT 'generating' NOT NULL,
	`error_message` text,
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
INSERT INTO `__new_skill_shreds`("id", "user_id", "topic", "current_context", "target_time_minutes", "toy_project_title", "blueprint_json", "status", "spike_completed_at", "completed_steps_json", "challenge_completed_at", "note_id", "created_at", "updated_at") SELECT "id", "user_id", "topic", "current_context", "target_time_minutes", "toy_project_title", "blueprint_json", "status", "spike_completed_at", "completed_steps_json", "challenge_completed_at", "note_id", "created_at", "updated_at" FROM `skill_shreds`;--> statement-breakpoint
DROP TABLE `skill_shreds`;--> statement-breakpoint
ALTER TABLE `__new_skill_shreds` RENAME TO `skill_shreds`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `skill_shreds_user_id_created_at_idx` ON `skill_shreds` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `skill_shreds_status_idx` ON `skill_shreds` (`user_id`,`status`);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `cv_parse_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `cv_audit_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `insights_status` text DEFAULT 'idle' NOT NULL;