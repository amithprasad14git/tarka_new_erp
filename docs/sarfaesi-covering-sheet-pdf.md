# SARFAESI covering sheet PDFs

Operator and developer guide for covering-sheet and NPA Acknowledgement prints on **SARFAESI Case Status Update**.

**Canonical documentation lives in the project [README.md](../README.md#sarfaesi-covering-sheet-pdfs)** (section *SARFAESI covering sheet PDFs*). Keep this file in sync when changing print behaviour.

## Quick links

| Print button | API | PDF module |
|--------------|-----|------------|
| Print 13/2 Covering Sheet | `GET /api/sarfaesi-case-status-update/covering-132-pdf/:id` | `lib/modules/sarfaesiCaseStatusUpdateCovering132Pdf.js` |
| Print 13/2 Paper Publication | `GET /api/sarfaesi-case-status-update/covering-132-paper-publication-pdf/:id` | same (variant) |
| Print 13(4) Covering Sheet | `GET /api/sarfaesi-case-status-update/covering-134-pdf/:id` | `lib/modules/sarfaesiCaseStatusUpdateCovering134Pdf.js` |
| Print NPA Acknowledgement | `GET /api/sarfaesi-case-status-update/npa-acknowledgement-pdf/:id` | `lib/modules/sarfaesiCaseStatusUpdateNpaAckPdf.js` |

## Layout (covering sheets)

- One A4 page, two equal halves, dashed mid-page guide (no Cut here label)
- Logo → green copy label → title → case fields table → intro → date box → red note → footer
- Case-table borders: `#222222` at 0.75pt
- No post-save ack print; toolbar only (view row / edit)
- Signatory = unit `personIncharge`; centre blank for hand stamp

## Layout (NPA Acknowledgement)

- Same dual-half A4 + dashed mid guide
- Logo → red title → 5-row case fields (incl. File Maintenance from NCI) → Documents Submitted checklist (empty checkboxes) | blank Acknowledgement
- No green copy labels, date box, or Printed On / person-in-charge footer
- Download: `NPA_ACK_<ref>.pdf`

## Child date source (covering sheets only)

| Print | Particular label (remarks) |
|-------|----------------------------|
| 13/2 Covering | Date of 13(2) |
| 13/2 Paper Publication | 13(2) Acknowledgements Received? |
| 13(4) Covering | Date of 13(4) |

Fallback: parent status-update `date`.

## Related

- [README §15 SARFAESI Case Status Update](../README.md#15-sarfaesi-case-status-update)
- [Invoice & letter PDFs](../README.md#invoice--letter-pdfs)
- [Code comments conventions](../README.md#code-comments-conventions)
