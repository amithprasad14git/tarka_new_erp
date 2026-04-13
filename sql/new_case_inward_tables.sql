-- =============================================================================
-- New Case Inward — parent + child (amount recovered)
-- =============================================================================
-- Run in MySQL after these tables exist: unit_master, branch_master,
-- lookup_value_master (and users if you add FKs on audit columns later).
-- Case No is auto-filled on save (bank prefix + loan category code + serial); sequence rows are auto-created (see lib/modules/newCaseInward.js).
-- Column names use camelCase to match config/modules.js and generic CRUD.
--
-- Usage: mysql -u USER -p YOUR_DB < sql/new_case_inward_tables.sql
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `new_case_inward` (
  `id` int NOT NULL AUTO_INCREMENT,
  `caseNo` varchar(64) DEFAULT NULL,
  `unit` int DEFAULT NULL,
  `entrustmentDate` date NOT NULL,
  `receivedFrom` int DEFAULT NULL,
  `fileMaintenance` int DEFAULT NULL,
  `branch` int DEFAULT NULL,
  `borrower` varchar(512) NOT NULL,
  `loanAccountNo` varchar(128) NOT NULL,
  `loanCategory` int DEFAULT NULL,
  `loanType` int DEFAULT NULL,
  `npaDate` date NOT NULL,
  `npaStatus` int DEFAULT NULL,
  `closureBalance` bigint NOT NULL,
  `createdBy` int DEFAULT NULL,
  `createdDate` datetime DEFAULT NULL,
  `modifiedBy` int DEFAULT NULL,
  `modifiedDate` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nci_unit` (`unit`),
  KEY `idx_nci_branch` (`branch`),
  CONSTRAINT `fk_nci_unit` FOREIGN KEY (`unit`) REFERENCES `unit_master` (`id`),
  CONSTRAINT `fk_nci_received_from` FOREIGN KEY (`receivedFrom`) REFERENCES `lookup_value_master` (`id`),
  CONSTRAINT `fk_nci_file_maintenance` FOREIGN KEY (`fileMaintenance`) REFERENCES `lookup_value_master` (`id`),
  CONSTRAINT `fk_nci_branch` FOREIGN KEY (`branch`) REFERENCES `branch_master` (`id`),
  CONSTRAINT `fk_nci_loan_category` FOREIGN KEY (`loanCategory`) REFERENCES `lookup_value_master` (`id`),
  CONSTRAINT `fk_nci_loan_type` FOREIGN KEY (`loanType`) REFERENCES `lookup_value_master` (`id`),
  CONSTRAINT `fk_nci_npa_status` FOREIGN KEY (`npaStatus`) REFERENCES `lookup_value_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `new_case_inward_amount_recovered` (
  `id` int NOT NULL AUTO_INCREMENT,
  `caseInwardId` int NOT NULL,
  `recoveredDate` date NOT NULL,
  `recoveredAmount` decimal(18,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nciar_case_inward` (`caseInwardId`),
  CONSTRAINT `fk_nciar_case_inward` FOREIGN KEY (`caseInwardId`) REFERENCES `new_case_inward` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
