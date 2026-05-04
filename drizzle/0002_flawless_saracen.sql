ALTER TABLE `appointments` ADD `discount` decimal(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `finalPrice` decimal(10,2) NOT NULL;