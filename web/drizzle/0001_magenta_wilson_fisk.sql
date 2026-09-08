CREATE TABLE `former_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`removed_at` text NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`)
);
