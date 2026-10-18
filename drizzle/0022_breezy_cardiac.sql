CREATE TABLE `daily_learning_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`reason` text NOT NULL,
	`practical_next_step` text NOT NULL,
	`suggested_outline` text,
	`suggested_tags` text,
	`source_context_summary` text,
	`regenerate_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_learning_suggestions_user_date_idx` ON `daily_learning_suggestions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `daily_learning_suggestions_user_created_idx` ON `daily_learning_suggestions` (`user_id`,`created_at`);