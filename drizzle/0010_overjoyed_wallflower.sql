CREATE TABLE `drive_meta_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`driveFileId` varchar(255) NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`fileSizeBytes` bigint,
	`mimeType` varchar(128),
	`metaVideoId` varchar(64),
	`metaVideoTitle` varchar(256),
	`status` enum('pending','downloading','uploading','processing','ready','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drive_meta_uploads_id` PRIMARY KEY(`id`)
);
