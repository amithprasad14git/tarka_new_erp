# Recovery Invoice PDF — simple guide

This note is for **operators**, **support staff**, and **developers** who need to understand the Recovery Invoice printout without reading all the drawing code.

**Layout status:** The on-page design is **frozen** (approved May 2026). Small text or data fixes are fine; changing column positions or spacing should be rare and tested on a real print/PDF.

See also: [invoices-pdf.md](invoices-pdf.md) (comparison of all invoice PDFs).

---

## What gets printed?

When you print a Recovery Invoice, the system creates **one PDF file** with **three pages**:

| Page | Label on the PDF (top right, green, bold) |
|------|---------------------------------------------|
| 1 | Triplicate - Charges Received Copy |
| 2 | Duplicate - Office Copy |
| 3 | Original - Branch Copy |

Each page is the **same invoice content**; only the copy name changes.

**Download name:** `Invoice_<invoice number>.pdf` (unsafe characters in the number are replaced).

---

## How do users open the PDF?

1. **After save** — On create or edit, the “saved” popup can offer **Print** (opens/downloads the PDF).
2. **From the list or view** — Use the **Print** action on a Recovery Invoice row (when your role allows it).
3. **Direct link (technical)** — `GET /api/recovery-invoice/pdf/<record id>` (must be logged in; server loads invoice data and builds the PDF).

---

## What data appears on the PDF?

The PDF is built from the saved Recovery Invoice and related master data:

| Section | Main source |
|---------|-------------|
| Bank, branch, place, RBO/RO | Branch on the linked **New Case Inward** → branch master chain |
| Invoice date, invoice number | Recovery Invoice record |
| Unit code | Unit on the case |
| Case number, borrower, loan details | Linked **New Case Inward** |
| Recovery details table | All **amount recovered** rows from that case |
| Recovery charges table | **recovery_charges** child rows on the invoice |
| Amount in words | Total of charge amounts (Indian wording) |
| GST number | **Current account** master linked on the invoice (`gstNo` field) |
| Account name, bank, branch, A/C no., IFSC | Same **current account** master |
| SBI vendor code | Shown only when the **case bank** code is **SBI** (header bank, not current-account bank) |
| RCM note | Fixed legal text (GST under reverse charge) |

There is **no** “Kindly transfer the invoice amount…” line on the PDF (removed by design).

---

## Page layout (top to bottom)

1. Company logo  
2. Copy label (Triplicate / Duplicate / Original)  
3. **Header table** — two columns: bank/branch on the left; date, invoice no, unit, case no, GST on the right  
4. “Recovery Invoice” badge image  
5. **Borrower block** — borrower, loan A/C, loan type, NPA date, account status  
6. **Two tables** — Recovery Details (left) and Recovery Charges (right), with totals  
7. **Amount in words** (bold)  
8. **Current account** (left, compact 9pt / 18pt rows) + **RCM note** (right)  
9. “Authorised Signatory” (right)  
10. Registered office **footer image**

Amounts in tables and totals use the **₹** symbol (not “Rs.”).

---

## Files (for developers)

| File | Role |
|------|------|
| `lib/modules/recoveryInvoicePdf.js` | **All layout and drawing** — frozen constants at the top; do not reuse header constants for the account block. |
| `lib/amountInWords.js` | Converts total amount to words for the “Amount in Words” line. |
| `app/api/recovery-invoice/pdf/[id]/route.js` | Loads data from DB, calls `buildRecoveryInvoicePdfBuffer`, returns PDF response. |
| `lib/modules/recoveryInvoiceClient.js` | Browser download helper for Print buttons. |
| `public/images/npa_full_transparent_bg.png` | Header logo |
| `public/images/npa_recovery_invoice.png` | Centre badge |
| `public/images/npa_regd_off_footer.png` | Page footer |
| `public/fonts/SamsungSharpSans-*.ttf` | Preferred fonts (falls back to Helvetica if missing) |

Tests: `tests/jest/recoveryInvoicePdf.test.js` (expects **3 pages**), `tests/jest/api.recovery-invoice-pdf.route.test.js`.

---

## Adjusting column widths (developers only)

The header and the current-account block use **separate** settings:

| Purpose | Constants in `recoveryInvoicePdf.js` |
|---------|--------------------------------------|
| Header left (Bank, Branch, …) | `HDR_LEFT_COLON_MM`, `HDR_LEFT_VALUE_MM` |
| Header right (Date, GST No, …) | `HDR_RIGHT_COLON_MM`, `HDR_RIGHT_VALUE_MM` |
| Current account labels | `ACCOUNT_LABEL_COLON_MM`, `ACCOUNT_VALUE_MM`, `FS_ACCOUNT`, `ACCOUNT_ROW_H` |

**Do not** set `ACCOUNT_*` equal to `HDR_*` — changing the header will then break the account table (or the other way around).

Value positions are usually: **colon position + `HDR_VALUE_GAP_MM`** (~4.6 mm after the colon).

After any layout change, print one real invoice and check: GST number, long bank names, account labels, and the RCM paragraph still fit.

---

## Common questions

**Why is GST wrong on the PDF but correct in master data?**  
The PDF shows `gstNo` from the **current account** linked on the invoice. Update that master record, not only the invoice header.

**Why three pages?**  
Legacy requirement: triplicate / duplicate / original on one download.

**Can we change colours or fonts?**  
Yes, but treat it as a layout change: edit the frozen sections in `recoveryInvoicePdf.js` and re-test all three pages.

**SARFAESI / Vehicle invoices**  
Same print pipeline; see [sarfaesi-invoice-pdf.md](sarfaesi-invoice-pdf.md) and [vehicle-invoice-pdf.md](vehicle-invoice-pdf.md).
