-- Human-readable business record label for audit_logs (e.g. invoice number, case no).
ALTER TABLE audit_logs
  ADD COLUMN record_label VARCHAR(255) NULL AFTER record_id;
