CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`subtitle` varchar(255),
	`barbers` varchar(100),
	`maxBarbers` int NOT NULL DEFAULT 1,
	`priceInCents` int NOT NULL,
	`originalPriceInCents` int,
	`features` text NOT NULL DEFAULT ('[]'),
	`isActive` boolean NOT NULL DEFAULT true,
	`isHighlighted` boolean NOT NULL DEFAULT false,
	`badge` varchar(64),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_slug_unique` UNIQUE(`slug`)
);
