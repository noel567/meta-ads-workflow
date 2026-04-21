CREATE TABLE `content_bot_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`autoSendMindset` boolean NOT NULL DEFAULT false,
	`autoSendRecap` boolean NOT NULL DEFAULT false,
	`autoSendSocialProof` boolean NOT NULL DEFAULT false,
	`autoSendScarcity` boolean NOT NULL DEFAULT false,
	`autoSendEveningRecap` boolean NOT NULL DEFAULT false,
	`timeMindset` varchar(5) NOT NULL DEFAULT '07:30',
	`timeRecap` varchar(5) NOT NULL DEFAULT '10:00',
	`timeSocialProof` varchar(5) NOT NULL DEFAULT '13:00',
	`timeScarcity` varchar(5) NOT NULL DEFAULT '17:00',
	`timeEveningRecap` varchar(5) NOT NULL DEFAULT '20:00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_bot_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_bot_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `content_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('mindset','recap','social_proof','scarcity','evening_recap') NOT NULL,
	`text` text NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','error','skipped') NOT NULL DEFAULT 'pending',
	`telegramMessageId` varchar(64),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_posts_id` PRIMARY KEY(`id`)
);
