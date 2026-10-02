CREATE TABLE `spark_tags` (
	`spark_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`spark_id`, `tag_id`),
	FOREIGN KEY (`spark_id`) REFERENCES `sparks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sparks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`promoted_type` text,
	`promoted_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sparks_user_id_status_created_at_idx` ON `sparks` (`user_id`,`status`,`created_at`);