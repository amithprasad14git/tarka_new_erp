-- =============================================================================
-- Invoices Received — payment receipt against one invoice (recovery / SARFAESI / vehicle)
-- =============================================================================
-- Run after: recovery_invoice, sarfaesi_invoice, vehicle_invoice, users (audit FKs),
-- financial_year_master, module_number_sequence.
--
-- Usage: mysql -u USER -p YOUR_DB < sql/invoices_received_tables.sql
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `invoices_received` (
  `id` int NOT NULL AUTO_INCREMENT,
  `refNo` varchar(64) DEFAULT NULL,
  `receivedDate` date NOT NULL,
  `recoveryInvoice` int DEFAULT NULL,
  `sarfaesiInvoice` int DEFAULT NULL,
  `vehicleInvoice` int DEFAULT NULL,
  `billedAmount` decimal(18,2) NOT NULL DEFAULT 0.00,
  `tdsPercentage` decimal(18,4) DEFAULT NULL,
  `tdsAmount` decimal(18,2) DEFAULT NULL,
  `receivedAmount` decimal(18,2) NOT NULL DEFAULT 0.00,
  `roundOff` varchar(32) DEFAULT NULL,
  `createdBy` int DEFAULT NULL,
  `createdDate` datetime DEFAULT NULL,
  `modifiedBy` int DEFAULT NULL,
  `modifiedDate` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_invoices_received_date` (`receivedDate`),
  UNIQUE KEY `uq_invoices_received_recovery` (`recoveryInvoice`),
  UNIQUE KEY `uq_invoices_received_sarfaesi` (`sarfaesiInvoice`),
  UNIQUE KEY `uq_invoices_received_vehicle` (`vehicleInvoice`),
  CONSTRAINT `fk_invoices_received_recovery` FOREIGN KEY (`recoveryInvoice`) REFERENCES `recovery_invoice` (`id`),
  CONSTRAINT `fk_invoices_received_sarfaesi` FOREIGN KEY (`sarfaesiInvoice`) REFERENCES `sarfaesi_invoice` (`id`),
  CONSTRAINT `fk_invoices_received_vehicle` FOREIGN KEY (`vehicleInvoice`) REFERENCES `vehicle_invoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
