CREATE TABLE `travel_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_invitations_token_hash_unique` ON `group_invitations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `members_user` ON `group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `group_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`author_id` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plans_group` ON `group_plans` (`group_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_token_hash_unique` ON `profiles` (`token_hash`);--> statement-breakpoint
CREATE TABLE `provider_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`error` text NOT NULL,
	`retry_at` integer NOT NULL
);
