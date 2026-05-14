PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_content_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text,
	`tmdb_id` integer,
	`content_type` text,
	`title` text,
	`reason` text DEFAULT 'not_found',
	`count` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_requested_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_content_requests`("id", "query", "count", "status", "last_requested_at", "created_at") SELECT "id", "query", "count", "status", "last_requested_at", "created_at" FROM `content_requests`;--> statement-breakpoint
DROP TABLE `content_requests`;--> statement-breakpoint
ALTER TABLE `__new_content_requests` RENAME TO `content_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `content_requests_query_unique` ON `content_requests` (`query`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_requests_tmdb_unique` ON `content_requests` (`tmdb_id`,`content_type`);--> statement-breakpoint
CREATE INDEX `content_requests_status_idx` ON `content_requests` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `reports_uniq_idx` ON `reports` (`content_type`,`content_id`,`issue_type`,`status`);