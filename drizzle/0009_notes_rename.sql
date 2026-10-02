ALTER TABLE `learning_notes` RENAME TO `notes`;--> statement-breakpoint
ALTER TABLE `note_tags` RENAME COLUMN `learning_note_id` TO `note_id`;--> statement-breakpoint
DROP INDEX IF EXISTS `learning_notes_user_id_workspace_id_idx`;--> statement-breakpoint
CREATE INDEX `notes_user_id_workspace_id_idx` ON `notes` (`user_id`,`workspace_id`);--> statement-breakpoint
UPDATE `attachments` SET `owner_type` = 'note' WHERE `owner_type` = 'learning-note';--> statement-breakpoint
UPDATE `sparks` SET `promoted_type` = 'note' WHERE `promoted_type` = 'learning-note';
