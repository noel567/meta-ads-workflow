CREATE TABLE `ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campaignId` int,
	`metaId` varchar(64) NOT NULL,
	`campaignMetaId` varchar(64),
	`name` varchar(255) NOT NULL,
	`status` varchar(32),
	`adsetName` varchar(255),
	`impressions` bigint,
	`reach` bigint,
	`clicks` bigint,
	`spend` float,
	`ctr` float,
	`cpc` float,
	`cpm` float,
	`roas` float,
	`conversions` float,
	`creativeType` varchar(32),
	`thumbnailUrl` text,
	`adText` text,
	`headline` varchar(512),
	`callToAction` varchar(64),
	`rawData` json,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metaId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(32),
	`objective` varchar(64),
	`dailyBudget` float,
	`lifetimeBudget` float,
	`startTime` timestamp,
	`stopTime` timestamp,
	`rawData` json,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitor_ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metaAdId` varchar(64),
	`pageName` varchar(255),
	`pageId` varchar(64),
	`adText` text,
	`headline` text,
	`callToAction` varchar(64),
	`imageUrl` text,
	`videoUrl` text,
	`startDate` varchar(32),
	`endDate` varchar(32),
	`country` varchar(8),
	`searchQuery` varchar(255),
	`rawData` json,
	`savedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`format` enum('markdown','pdf') NOT NULL DEFAULT 'markdown',
	`sourceType` enum('transcript','analysis') NOT NULL DEFAULT 'transcript',
	`sourceId` int,
	`fileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`adAccountId` varchar(64) NOT NULL,
	`adAccountName` varchar(255),
	`appId` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`sourceType` enum('competitor_ad','manual','ai_generated') NOT NULL DEFAULT 'manual',
	`sourceId` int,
	`tags` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transcripts_id` PRIMARY KEY(`id`)
);
