CREATE TABLE `ads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`image_url` text,
	`redirect_url` text,
	`unit_id` text,
	`is_active` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`frequency_limit` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ads_position_idx` ON `ads` (`position`);--> statement-breakpoint
CREATE INDEX `ads_is_active_idx` ON `ads` (`is_active`);--> statement-breakpoint
CREATE INDEX `ads_priority_idx` ON `ads` (`priority`);