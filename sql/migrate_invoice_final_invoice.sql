-- =============================================================================
-- Final Invoice — new_case_inward flag + invoice parent columns
-- =============================================================================
-- Run after: new_case_inward, recovery_invoice, sarfaesi_invoice, vehicle_invoice tables exist.
--
-- Usage: mysql -u USER -p YOUR_DB < sql/migrate_invoice_final_invoice.sql
-- =============================================================================

SET NAMES utf8mb4;

ALTER TABLE `new_case_inward`
  ADD COLUMN `finalInvoice` varchar(8) NOT NULL DEFAULT 'No' AFTER `closureBalance`;

ALTER TABLE `recovery_invoice`
  ADD COLUMN `finalInvoice` varchar(8) NOT NULL DEFAULT 'No' AFTER `cancelledInvoice`;

ALTER TABLE `sarfaesi_invoice`
  ADD COLUMN `finalInvoice` varchar(8) NOT NULL DEFAULT 'No' AFTER `cancelledInvoice`;

ALTER TABLE `vehicle_invoice`
  ADD COLUMN `finalInvoice` varchar(8) NOT NULL DEFAULT 'No' AFTER `cancelledInvoice`;
