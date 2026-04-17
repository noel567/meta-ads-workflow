CREATE TABLE `ad_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`sourceAdId` int,
	`sourceAdText` text,
	`competitorName` varchar(255),
	`body` text NOT NULL,
	`cta` text NOT NULL,
	`hook1` text NOT NULL,
	`hook2` text NOT NULL,
	`hook3` text NOT NULL,
	`heygenScript` text,
	`status` enum('draft','ready','exported','used') NOT NULL DEFAULT 'draft',
	`language` varchar(16) DEFAULT 'de',
	`brandContext` text,
	`googleDriveFileId` varchar(255),
	`googleDriveUrl` text,
	`transcriptId` int,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandName` varchar(255) NOT NULL DEFAULT 'Easy Signals',
	`brandDescription` text,
	`targetAudience` text,
	`toneOfVoice` varchar(128),
	`uniqueSellingPoints` text,
	`callToActionDefault` varchar(255),
	`language` varchar(16) NOT NULL DEFAULT 'de',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`pageId` varchar(64),
	`pageName` varchar(255),
	`country` varchar(8) NOT NULL DEFAULT 'DE',
	`language` varchar(16) DEFAULT 'de',
	`isActive` boolean NOT NULL DEFAULT true,
	`lastScannedAt` timestamp,
	`totalAdsFound` int NOT NULL DEFAULT 0,
	`newAdsSinceLastScan` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_drive_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenExpiry` timestamp,
	`rootFolderId` varchar(255),
	`rootFolderName` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_drive_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_drive_connections_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `scan_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`competitorId` int,
	`competitorName` varchar(255),
	`adsFound` int NOT NULL DEFAULT 0,
	`newAds` int NOT NULL DEFAULT 0,
	`batchesCreated` int NOT NULL DEFAULT 0,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `scan_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `sourceType` enum('transcript','analysis','batch') NOT NULL DEFAULT 'transcript';--> statement-breakpoint
ALTER TABLE `transcripts` MODIFY COLUMN `sourceType` enum('competitor_ad','manual','ai_generated','batch') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `competitor_ads` ADD `competitorId` int;--> statement-breakpoint
ALTER TABLE `competitor_ads` ADD `detectedLanguage` varchar(16);--> statement-breakpoint
ALTER TABLE `competitor_ads` ADD `isProcessed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `googleDriveFileId` varchar(255);--> statement-breakpoint
ALTER TABLE `documents` ADD `googleDriveUrl` text;