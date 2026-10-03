CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`url` text,
	`label` text,
	`kind` text,
	`locator` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sources_owner_idx` ON `sources` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `sources_user_id_idx` ON `sources` (`user_id`);