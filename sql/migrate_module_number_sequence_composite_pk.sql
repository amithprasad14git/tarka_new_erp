-- =============================================================================
-- One-time fix: allow several prefixes per module in module_number_sequence
-- =============================================================================
-- Older installs used PRIMARY KEY (`module`) only, so you could store one prefix
-- per screen. New Case Inward needs one row per bank prefix, so the primary key
-- must be (`module`, `prefix`). Run this once on those older databases; skip if
-- your table was already created with the composite key.
-- =============================================================================

SET NAMES utf8mb4;

ALTER TABLE `module_number_sequence`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`module`, `prefix`);
