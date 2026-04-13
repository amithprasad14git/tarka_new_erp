-- =============================================================================
-- module_number_sequence — “last number used” per document prefix
-- =============================================================================
-- In simple terms:
--   • Each row is one counter for a type of reference number (e.g. Case No).
--   • `module` tells which screen uses it (here: new_case_inward).
--   • For New Case Inward, `prefix` is `{bankCaseNoPrefix}/{loanCategoryCode}` (e.g. SBI/CF);
--     the app creates rows automatically on first use.
--   • `lastNumber` is the last number issued; the app adds 1 for the next save.
--
-- If your table was first created with only one primary key on `module`, run:
--   sql/migrate_module_number_sequence_composite_pk.sql
-- To widen `prefix` from varchar(32) to varchar(64), run:
--   sql/migrate_module_number_sequence_prefix_64.sql
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `module_number_sequence` (
  `module` varchar(64) NOT NULL,
  `prefix` varchar(64) NOT NULL,
  `lastNumber` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`module`, `prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
