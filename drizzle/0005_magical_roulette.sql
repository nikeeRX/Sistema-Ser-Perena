ALTER TABLE `products` ADD `branchId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `commissionPercentage` decimal(5,2) DEFAULT '10' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `quantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;