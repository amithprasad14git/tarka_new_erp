-- Widen module_number_sequence.prefix for composite Case No keys (bank + loan category).
-- Safe to run once; no-op if already varchar(64) or larger.

ALTER TABLE `module_number_sequence`
  MODIFY COLUMN `prefix` varchar(64) NOT NULL;
