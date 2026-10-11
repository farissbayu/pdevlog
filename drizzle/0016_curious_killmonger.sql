CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skills_user_id_idx` ON `skills` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `skills_user_id_slug_unique` ON `skills` (`user_id`,`slug`);--> statement-breakpoint
CREATE TABLE `skill_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`level` integer NOT NULL,
	`title` text NOT NULL,
	`criteria` text NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	`achieved_at` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_milestones_user_skill_idx` ON `skill_milestones` (`user_id`,`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_milestones_skill_level_idx` ON `skill_milestones` (`skill_id`,`level`);--> statement-breakpoint
CREATE TABLE `milestone_evidences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`milestone_id` text NOT NULL,
	`evidence_type` text NOT NULL,
	`evidence_id` text NOT NULL,
	`reflection` text,
	`confidence` integer,
	`auto_detected` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `skill_milestones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestone_evidences_milestone_idx` ON `milestone_evidences` (`milestone_id`);--> statement-breakpoint
CREATE INDEX `milestone_evidences_user_item_idx` ON `milestone_evidences` (`user_id`,`evidence_type`,`evidence_id`);