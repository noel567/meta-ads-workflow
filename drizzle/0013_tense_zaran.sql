ALTER TABLE `content_bot_settings` ADD `autoSendQuote` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `content_bot_settings` ADD `timeQuote` varchar(5) DEFAULT '09:00' NOT NULL;