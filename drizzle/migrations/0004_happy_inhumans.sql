CREATE TABLE `updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `updates_created_idx` ON `updates` (`created_at`);--> statement-breakpoint
CREATE INDEX `updates_expires_idx` ON `updates` (`expires_at`);