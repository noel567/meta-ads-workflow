CREATE TABLE `budget_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`metric` varchar(32) NOT NULL,
	`condition` varchar(8) NOT NULL,
	`threshold` float NOT NULL,
	`action` varchar(16) NOT NULL,
	`changePercent` float,
	`maxBudgetCents` int,
	`minBudgetCents` int,
	`campaignId` varchar(32),
	`campaignName` varchar(256),
	`lookbackDays` int NOT NULL DEFAULT 7,
	`cooldownDays` int NOT NULL DEFAULT 1,
	`lastExecutedAt` timestamp,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `budget_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rule_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleId` int NOT NULL,
	`ruleName` varchar(128),
	`executedAt` timestamp NOT NULL DEFAULT (now()),
	`triggered` boolean NOT NULL,
	`campaignId` varchar(32),
	`campaignName` varchar(256),
	`metricValue` float,
	`oldBudgetCents` int,
	`newBudgetCents` int,
	`reason` text,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	CONSTRAINT `rule_executions_id` PRIMARY KEY(`id`)
);
