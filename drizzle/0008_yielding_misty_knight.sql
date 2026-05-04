ALTER TABLE `access_tokens` ADD `activatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `access_tokens` ADD `durationDays` int DEFAULT 90;