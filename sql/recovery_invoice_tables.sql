-- =============================================================================
-- Recovery Invoice — parent + child (charges)
-- =============================================================================
-- Run after: unit_master, branch_master, lookup_value_master, new_case_inward,
-- current_account_master, users (audit FKs), financial_year_master (for INV no. FY),
-- module_number_sequence (created by module_number_sequence.sql).
--
-- Usage: mysql -u USER -p YOUR_DB < sql/recovery_invoice_tables.sql
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `recovery_invoice` (
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
  KEY `idx_recovery_invoice_case` (`caseNo`),
  KEY `idx_recovery_invoice_date` (`date`),
  CONSTRAINT `fk_recovery_invoice_case` FOREIGN KEY (`caseNo`) REFERENCES `new_case_inward` (`id`),
  CONSTRAINT `fk_recovery_invoice_npa_ac` FOREIGN KEY (`npaCurrentAc`) REFERENCES `current_account_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recovery_invoice_charges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `recoveryInvoiceId` int NOT NULL,
  `percentage` decimal(18,4) DEFAULT NULL,
  `amount` decimal(18,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recovery_charges_parent` (`recoveryInvoiceId`),
  CONSTRAINT `fk_recovery_charges_parent` FOREIGN KEY (`recoveryInvoiceId`) REFERENCES `recovery_invoice` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
