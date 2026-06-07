# Return Case PDF — simple guide

This note is for **operators**, **support staff**, and **developers** who need to understand the Return Case letter printout without reading the drawing code.

**What is a Return Case?**  
When recovery is not possible, staff record a **Return Case** in the ERP. The system can then print a formal **letter to the bank** explaining why the loan account is being returned.

**Layout status:** Typography and spacing follow the same **frozen** recovery-invoice style (9pt body, compact table rows). Layout changes should be rare and tested on a real print/PDF.

See also: [invoices-pdf.md](invoices-pdf.md) (invoice PDFs; Return Case is a **letter**, not an invoice).

---

## What gets printed?

When you print a Return Case, the system creates **one PDF file** with **three pages**:

| Page | Label on the PDF (top right, green, bold) |
|------|---------------------------------------------|
| 1 | Triplicate - Office Copy |
| 2 | Duplicate - RBO/RO/ZO Copy |
| 3 | Original - Branch Copy |

Each page is the **same letter content**; only the copy name changes.

**Download name:** `RETURN_<ref no>.pdf` (slashes in the ref become underscores; unsafe characters are replaced).

---

## How do users get the PDF?

1. **After save** — On create or edit, the “Return Case saved” popup can offer **Print** (downloads the file, same as invoice PDFs).
2. **From the list or view** — Use **Print** on the Return Case row or in the view grid.
3. **While editing** — **Print** in the edit toolbar.
4. **Direct link (technical)** — `GET /api/return-case/pdf/<record id>` (must be logged in; browser receives a download, not an inline preview).

---

## What data appears on the PDF?

| Section | Main source |
|---------|-------------|
| Bank, branch, RBO/RO | Branch on the linked **New Case Inward** → branch master chain |
| Date, ref no, unit, case no | Return Case record |
| Borrower, loan A/C, category, type, NPA status, closure balance, entrustment date | Linked **New Case Inward** |
| Investigating officer | Return Case (employee lookup) |
| Letter body | Fixed template (returning NPA account due to non-recovery) |
| Reasons table | **return_case_details** child rows where **Select** is checked only |
| Alternative steps paragraph | Fixed legal text (no further recovery / no recovery charges) |
| Borrower Latest Details | Return Case field (optional bordered box) |
| CC to | Return Case field (optional line after signatory, **bold**) |
| Signatory | Fixed “for NPA Enforcement Squad” / Authorised Signatory |
| Footer | Registered office image |

Unchecked detail rows are **not** printed or saved (only checked rows are kept on submit).

---

## Page layout (top to bottom)

1. Company logo  
2. Copy label (Triplicate / Duplicate / Original)  
3. **Header 1** — Kind Attn., bank, branch, RBO/RO | date, ref no, unit, case no  
4. **Header 2** — borrower, loan A/C, category, type | entrustment date, IO, loan type, closure balance  
5. **Letter body** — salutation, subject, intro paragraphs, “reasons/remarks” lead-in  
6. **Details table** — Sl. No. | Reason/Remarks (selected child rows only)  
7. **Alternative steps** — fixed paragraph  
8. **Borrower Latest Details** (optional box)  
9. Sign-off block (“for NPA Enforcement Squad” → “Authorised Signatory”)  
10. **CC to:** line (optional, after Authorised Signatory, bold)  
11. Registered office **footer image**

---

## Files (for developers)

| File | Role (plain English) |
|------|----------------------|
| `lib/modules/returnCasePdf.js` | Draws the PDF — layout, fonts, 3 pages |
| `lib/modules/returnCaseClient.js` | Browser Print button → `downloadReturnCasePdf` |
| `lib/modules/returnCase.js` | Save rules (Returned case, checked reasons, FY freeze) |
| `app/api/return-case/pdf/[id]/route.js` | Loads data from DB, calls PDF builder, sends download |
| `components/MasterModuleClient.js` | Wires Print in toolbar and post-save popup |
| `config/modules.js` | `return_case` fields + `postCreateAck.showPrintPdf` |

---

## Tests

| File | What it checks |
|------|----------------|
| `tests/jest/returnCasePdf.test.js` | PDF builds, 3 pages, filename, row filter |
| `tests/jest/api.return-case-pdf.route.test.js` | Login required, correct data passed to PDF builder |
| `tests/jest/returnCase.test.js` | Save validation rules |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Print button missing | User needs **view** permission; row must be saved (have an id) |
| Empty borrower block | Linked New Case Inward not found or case not saved yet |
| Reason missing on PDF | Row was not **checked** in Select column |
| Download fails | Session expired, or server error building PDF — check browser network tab |
