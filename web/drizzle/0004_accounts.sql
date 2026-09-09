CREATE TABLE `account_identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`account_id` text NOT NULL,
	PRIMARY KEY(`provider`, `subject`)
);
--> statement-breakpoint
CREATE INDEX `identities_account` ON `account_identities` (`account_id`);--> statement-breakpoint
CREATE TABLE `account_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_account` ON `account_sessions` (`account_id`);--> statement-breakpoint
CREATE TABLE `account_travel_state` (
	`account_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`handle` text,
	`password_hash` text,
	`profile_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_handle_unique` ON `accounts` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_profile_id_unique` ON `accounts` (`profile_id`);--> statement-breakpoint
CREATE TABLE `claimed_identities` (
	`kind` text NOT NULL,
	`legacy_hash` text NOT NULL,
	`account_id` text NOT NULL,
	PRIMARY KEY(`kind`, `legacy_hash`)
);
--> statement-breakpoint
CREATE TABLE `oauth_flows` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`cookie_hash` text NOT NULL,
	`provider` text NOT NULL,
	`verifier` text NOT NULL,
	`account_id` text,
	`return_to` text NOT NULL,
	`expires_at` integer NOT NULL
);
