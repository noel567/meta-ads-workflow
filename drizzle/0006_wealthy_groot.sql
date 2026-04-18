CREATE TABLE `telegram_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`textContent` text NOT NULL,
	`imageUrl` text,
	`imagePrompt` text,
	`topic` varchar(255),
	`contentType` enum('tip','insight','motivation','market_update','signal_preview','education','social_proof') NOT NULL DEFAULT 'tip',
	`status` enum('draft','scheduled','sent','failed') NOT NULL DEFAULT 'draft',
	`errorMessage` text,
	`telegramMessageId` varchar(64),
	`chatId` varchar(64),
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`postingTimeHour` int NOT NULL DEFAULT 9,
	`postingTimeMinute` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`defaultLanguage` varchar(8) NOT NULL DEFAULT 'de',
	`includeEmoji` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_settings_userId_unique` UNIQUE(`userId`)
);
