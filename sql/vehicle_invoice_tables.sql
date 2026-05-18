-- =============================================================================
-- Vehicle Invoice — parent + child (seizing charges)
-- =============================================================================
-- Run after: new_case_inward, current_account_master, users (audit FKs),
-- financial_year_master, module_number_sequence.
--
-- Usage: mysql -u USER -p YOUR_DB < sql/vehicle_invoice_tables.sql
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `vehicle_invoice` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoiceNo` varchar(64) DEFAULT NULL,
  `date` date NOT NULL,
  `caseNo` int NOT NULL,
  `npaCurrentAc` int NOT NULL,
  `cancelledInvoice` varchar(8) NOT NULL DEFAULT 'No',
  `finalInvoice` varchar(8) NOT NULL DEFAULT 'No',
  `cancellationReason` varchar(1024) DEFAULT NULL,
  `grandTotal` decimal(18,2) NOT NULL DEFAULT 0.00,
  `createdBy` int DEFAULT NULL,
  `createdDate` datetime DEFAULT NULL,
  `modifiedBy` int DEFAULT NULL,
  `modifiedDate` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_invoice_case` (`caseNo`),
  KEY `idx_vehicle_invoice_date` (`date`),
  CONSTRAINT `fk_vehicle_invoice_case` FOREIGN KEY (`caseNo`) REFERENCES `new_case_inward` (`id`),
  CONSTRAINT `fk_vehicle_invoice_npa_ac` FOREIGN KEY (`npaCurrentAc`) REFERENCES `current_account_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vehicle_invoice_charges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicleInvoiceId` int NOT NULL,
  `particulars` int NOT NULL,
  `remarks` varchar(1024) NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_charges_parent` (`vehicleInvoiceId`),
  CONSTRAINT `fk_vehicle_charges_parent` FOREIGN KEY (`vehicleInvoiceId`) REFERENCES `vehicle_invoice` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
