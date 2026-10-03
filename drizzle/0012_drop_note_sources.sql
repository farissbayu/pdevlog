INSERT INTO `sources` (`id`, `user_id`, `owner_type`, `owner_id`, `url`, `label`, `kind`, `locator`, `position`, `created_at`)
SELECT `id`, `user_id`, 'note', `note_id`, `url`, `label`, NULL, NULL, `position`, `created_at` FROM `note_sources`;--> statement-breakpoint
DROP TABLE `note_sources`;
