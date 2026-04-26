CREATE TABLE `ad_headlines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`imageAdId` int NOT NULL,
	`text` varchar(512) NOT NULL,
	`status` enum('draft','testing','active','paused','winner') NOT NULL DEFAULT 'draft',
	`tested` boolean NOT NULL DEFAULT false,
	`ctr` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ad_headlines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `image_ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`style` enum('luxury','trading_lifestyle','results_proof','dark_premium') NOT NULL DEFAULT 'luxury',
	`prompt` text,
	`imageUrl` text,
	`driveFileId` varchar(255),
	`driveUrl` text,
	`metaAdId` varchar(64),
	`metaUploadStatus` enum('none','pending','uploaded','error') NOT NULL DEFAULT 'none',
	`boardX` int NOT NULL DEFAULT 0,
	`boardY` int NOT NULL DEFAULT 0,
	`boardStatus` enum('draft','testing','active','paused','winner') NOT NULL DEFAULT 'draft',
	`ctr` float,
	`cpc` float,
	`spend` float,
	`impressions` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `image_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`lastExpandedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`hook` text NOT NULL,
	`body` text NOT NULL,
	`cta` text NOT NULL,
	`fullScript` text,
	`avatarId` varchar(128),
	`voiceId` varchar(128),
	`heygenVideoId` varchar(128),
	`videoUrl` text,
	`thumbnailUrl` text,
	`driveFileId` varchar(255),
	`driveUrl` text,
	`status` enum('draft','generating','ready','error') NOT NULL DEFAULT 'draft',
	`errorMessage` text,
	`aspectRatio` varchar(8) NOT NULL DEFAULT '9:16',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `content_bot_settings` ADD `defaultBackgroundStyle` varchar(32) DEFAULT 'trading' NOT NULL;--> statement-breakpoint
ALTER TABLE `content_posts` ADD `backgroundStyle` varchar(32);