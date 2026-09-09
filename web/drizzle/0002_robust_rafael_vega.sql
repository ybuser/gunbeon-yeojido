CREATE TABLE `advice_rate` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `advice_reports` (
	`suggestion_id` text NOT NULL,
	`visitor_hash` text NOT NULL,
	PRIMARY KEY(`suggestion_id`, `visitor_hash`)
);
--> statement-breakpoint
CREATE TABLE `advice_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `advice_owner` ON `advice_shares` (`owner_hash`);--> statement-breakpoint
CREATE INDEX `advice_expiry` ON `advice_shares` (`expires_at`);--> statement-breakpoint
CREATE TABLE `advice_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`place_id` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `advice_share` ON `advice_suggestions` (`share_id`);