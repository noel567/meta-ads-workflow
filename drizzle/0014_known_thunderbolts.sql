CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `api_keys` MODIFY COLUMN `keyPreview` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `content_posts` MODIFY COLUMN `type` enum('mindset','recap','social_proof','scarcity','evening_recap','quote') NOT NULL;--> statement-breakpoint
ALTER TABLE `content_posts` ADD `imageUrl` text;--> statement-breakpoint
ALTER TABLE `content_posts` ADD `dalleBackgroundUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);