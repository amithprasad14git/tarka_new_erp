# SARFAESI Invoice PDF — simple guide

This note explains the **SARFAESI Invoice** printout for operators and developers. Layout matches the **Recovery** and **Vehicle Invoice** PDFs (11pt body, 13pt section titles, 10pt table headers; faint horizontal row lines, darker grid lines). Uses **one full-width charges table** (no recovery-details / amount-recovered table).

See also: [invoices-pdf.md](invoices-pdf.md) (comparison of all invoice PDFs).

---

## What gets printed?

One PDF file with **three pages** (same copy labels as Recovery Invoice):

| Page | Label (top right, green, bold) |
|------|--------------------------------|
| 1 | Triplicate - Charges Received Copy |
| 2 | Duplicate - Office Copy |
| 3 | Original - Branch Copy |

**Download name:** `Invoice_<invoice number>.pdf`

---

## How do users open the PDF?

1. **After save** — Create or edit a SARFAESI Invoice; the acknowledgement popup can show **Print**.
2. **While editing a saved row** — Use **Print** in the entry toolbar (left side).
3. **View grid** — **Print** on the selected row when in view mode.
4. **API** — `GET /api/sarfaesi-invoice/pdf/<record id>` (logged-in user, view permission on the module).

---

## What data appears on the PDF?

| Section | Source |
|---------|--------|
| Bank, branch, place, RBO/RO | Branch chain from linked **New Case Inward** (`caseNo`); RBO/RO prints **short code** (falls back to full name) |
| Invoice date, invoice number | **sarfaesi_invoice** row |
| Unit | **`billToUnit`** on the invoice → `unit_master` (not the case unit) |
| Case number, borrower, loan type | Linked **New Case Inward** via `caseNo` |
| Charges table | Child rows in **sarfaesi_invoice_charges** (`sarfaesi_charges` key): SL, Particulars, Remarks, Amount |
| Amount in words | Sum of charge **Amount** values |
| GST number | **current_account_master** linked on the invoice |
| Account block + RCM note | Same **current account**; RCM text is fixed legal wording |
| Vendor code | Only if **case bank** code is **SBI** |
| Footer | Registered office image |

Amounts use the **₹** symbol. Long particulars/remarks **wrap**; row height grows automatically.

**Difference from Recovery Invoice:** Recovery prints two side-by-side tables (recovery details + charges). SARFAESI prints only the charges grid at full page width. There is **no** “SARFAESI CHARGES” title row above the table.

---

## Page layout (top to bottom)

1. Company logo  
2. Copy label  
3. Header block — faint horizontal row lines; vertical split between bank/branch and date/invoice columns  
4. Centre badge (`npa_sarfaesi_invoice.png`, or recovery badge if missing)  
5. Borrower block — borrower, loan A/C no., loan type (faint horizontal row lines)  
6. Charges grid + TOTAL row  
7. Amount in words (bold)  
8. Current account (11pt / 19pt rows) + RCM note (auto-fit from 10pt)  
9. Authorised Signatory (right)  
10. Footer image  

---

## Files (developers)

| File | Role |
|------|------|
| `lib/modules/sarfaesiInvoicePdf.js` | All PDF layout and drawing |
| `lib/amountInWords.js` | Amount-in-words line |
| `app/api/sarfaesi-invoice/pdf/[id]/route.js` | Loads DB data and returns PDF |
| `lib/modules/sarfaesiInvoiceClient.js` | Browser download + Print button helpers |
| `config/modules.js` | `sarfaesi_invoice.postCreateAck.showPrintPdf`, child `sarfaesi_charges` |

Tests: `tests/jest/sarfaesiInvoicePdf.test.js`, `tests/jest/api.sarfaesi-invoice-pdf.route.test.js`.

---

## Column tuning (developers)

Header and account columns are **independent** (same rules as Recovery — see [recovery-invoice-pdf.md](recovery-invoice-pdf.md)):

- `HDR_*` — header grid only  
- `ACCOUNT_*`, `FS_ACCOUNT`, `ACCOUNT_PAD_*`, `ACCOUNT_ROW_H` (18pt rows) — current account block only  
- `CHARGES_COLS_MM` — charges table column widths (mm)

Centre badge: tries `public/images/npa_sarfaesi_invoice.png`, then `npa_recovery_invoice.png`.

---

## Common questions

**Why is GST wrong on the PDF?**  
Update **GST No.** on the **Current Account** master linked on the invoice (`npaCurrentAc`), not only the invoice row.

**Particulars column is empty or shows an ID**  
Ensure charge lines are saved; `getCrudRecordById` enriches child rows with `particularsLabel` from **SARFAESI Invoice Particulars** lookup values.

**Vendor code on a non-SBI case**  
Vendor code follows the **case bank** (header), not the remittance account bank. See [invoices-pdf.md](invoices-pdf.md).
