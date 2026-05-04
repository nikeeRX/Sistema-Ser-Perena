CREATE TABLE `scheduling` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`barberId` int NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientPhone` varchar(20),
	`scheduledDate` datetime NOT NULL,
	`scheduledEndDate` datetime,
	`status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`appointmentId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduling_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','owner','barber') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `appointments` ADD `clientName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `barberId` int;--> statement-breakpoint
ALTER TABLE `scheduling` ADD CONSTRAINT `scheduling_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduling` ADD CONSTRAINT `scheduling_barberId_barbers_id_fk` FOREIGN KEY (`barberId`) REFERENCES `barbers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduling` ADD CONSTRAINT `scheduling_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE set null ON UPDATE no action;