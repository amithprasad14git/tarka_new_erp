-- One-time backfill: copy case unit onto invoice billToUnit where not yet set.
-- Run before relying on dashboard/reports with billToUnit-only SQL.

UPDATE recovery_invoice ri
INNER JOIN new_case_inward nci ON nci.id = ri.caseNo
SET ri.billToUnit = nci.unit
WHERE ri.billToUnit IS NULL AND ri.caseNo IS NOT NULL;

UPDATE sarfaesi_invoice si
INNER JOIN new_case_inward nci ON nci.id = si.caseNo
SET si.billToUnit = nci.unit
WHERE si.billToUnit IS NULL AND si.caseNo IS NOT NULL;

UPDATE vehicle_invoice vi
INNER JOIN new_case_inward nci ON nci.id = vi.caseNo
SET vi.billToUnit = nci.unit
WHERE vi.billToUnit IS NULL AND vi.caseNo IS NOT NULL;
