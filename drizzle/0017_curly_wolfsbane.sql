CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`headline` text,
	`bio` text,
	`primary_stack` text,
	`cv_markdown` text,
	`cv_extracted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
