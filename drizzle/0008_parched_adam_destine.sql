CREATE TABLE `ad_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adId` varchar(64) NOT NULL,
	`adName` text,
	`campaignName` text,
	`text` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ad_comments_id` PRIMARY KEY(`id`)
);
