-- Merge per-screen invoice sequence rows into one shared counter (module = 'invoice').
-- Run once if you already have recovery_invoice / sarfaesi_invoice / vehicle_invoice rows in module_number_sequence.
--
-- Usage: mysql -u USER -p YOUR_DB < sql/migrate_invoice_shared_sequence.sql

SET NAMES utf8mb4;

INSERT INTO `module_number_sequence` (`module`, `prefix`, `lastNumber`)
SELECT 'invoice', `prefix`, MAX(`lastNumber`)
FROM `module_number_sequence`
WHERE `module` IN ('invoice', 'recovery_invoice', 'sarfaesi_invoice', 'vehicle_invoice')
GROUP BY `prefix`
ON DUPLICATE KEY UPDATE `lastNumber` = GREATEST(`module_number_sequence`.`lastNumber`, VALUES(`lastNumber`));

DELETE FROM `module_number_sequence`
WHERE `module` IN ('recovery_invoice', 'sarfaesi_invoice', 'vehicle_invoice');
