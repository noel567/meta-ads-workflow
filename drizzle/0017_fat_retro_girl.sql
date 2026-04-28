ALTER TABLE `meta_connections` ADD `pageToken` text;--> statement-breakpoint
ALTER TABLE `meta_connections` ADD `pageId` varchar(64);--> statement-breakpoint
ALTER TABLE `meta_connections` ADD `pageName` varchar(255);--> statement-breakpoint
ALTER TABLE `meta_connections` ADD `scopes` text;