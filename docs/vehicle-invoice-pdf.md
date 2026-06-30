# Vehicle Invoice PDF — simple guide

This note explains the **Vehicle Invoice** printout for operators and developers. Layout matches the **SARFAESI Invoice** PDF: one full-width charges table, same header/account/footer pattern.

See also: [invoices-pdf.md](invoices-pdf.md) (comparison of all invoice PDFs).

---

## What gets printed?

One PDF file with **three pages** (same copy labels as Recovery / SARFAESI):

| Page | Label (top right, green, bold) |
|------|--------------------------------|
| 1 | Triplicate - Charges Received Copy |
| 2 | Duplicate - Office Copy |
| 3 | Original - Branch Copy |

**Download name:** `Invoice_<invoice number>.pdf`

---

## How do users open the PDF?

1. **After save** — Create or edit a Vehicle Invoice; the acknowledgement popup can show **Print**.
2. **While editing a saved row** — Use **Print** in the entry toolbar (left side).
3. **View grid** — **Print** on the selected row when in view mode.
4. **API** — `GET /api/vehicle-invoice/pdf/<record id>` (logged-in user, view permission on the module).

---

## What data appears on the PDF?

| Section | Source |
|---------|--------|
| Bank, branch, place, RBO/RO | Branch chain from linked **New Case Inward** (`caseNo`) |
| Invoice date, invoice number | **vehicle_invoice** row |
| Unit | **`billToUnit`** on the invoice → `unit_master` (not the case unit) |
| Case number, borrower, loan type | Linked **New Case Inward** via `caseNo` |
| Charges table | Child rows in **vehicle_invoice_charges** (`vehicle_charges` key): SL, Particulars, Remarks, Amount |
| Amount in words | Sum of charge **Amount** values |
| GST number | **current_account_master** linked on the invoice (`npaCurrentAc`) |
| Account block + RCM note | Same **current account**; fixed RCM legal wording |
| Vendor code | Only if **case bank** code is **SBI** |
| Footer | Registered office image |

Amounts use the **₹** symbol. Long particulars/remarks **wrap**; row height grows automatically.

There is **no** merged title row above the charges table (headers start at SL. NO. / PARTICULARS / …).

---

## Page layout (top to bottom)

1. Company logo  
2. Copy label (Triplicate / Duplicate / Original)  
3. Header table (Kind Attn., Bank, Branch, Date, Invoice No, Unit, Case No, GST, …)  
4. Centre badge (`npa_vehicle_invoice.png`, or recovery badge if missing)  
5. Borrower block — borrower, loan A/C no., loan type  
6. Charges grid + TOTAL row  
7. Amount in words (bold)  
8. Current account (left, compact) + RCM note (right)  
9. Authorised Signatory (right)  
10. Registered office footer image  

---

## Files (developers)

| File | Role |
|------|------|
| `lib/modules/vehicleInvoicePdf.js` | All PDF layout and drawing (standalone; mirrors SARFAESI) |
| `lib/amountInWords.js` | Amount-in-words line |
| `app/api/vehicle-invoice/pdf/[id]/route.js` | Loads DB data and returns PDF |
| `lib/modules/vehicleInvoiceClient.js` | Browser download + Print button helpers |
| `config/modules.js` | `vehicle_invoice.postCreateAck.showPrintPdf`, child `vehicle_charges` |

Tests: `tests/jest/vehicleInvoicePdf.test.js`, `tests/jest/api.vehicle-invoice-pdf.route.test.js`.

---

## Column tuning (developers)

Same rules as SARFAESI / Recovery:

- `HDR_*` — header grid only  
- `ACCOUNT_*`, `FS_ACCOUNT`, `ACCOUNT_PAD_*`, `ACCOUNT_ROW_H` — current account block only  
- `CHARGES_COLS_MM` — charges table column widths (mm): `[12, 75, 58, 45]`

Centre badge: `public/images/npa_vehicle_invoice.png`, then `npa_recovery_invoice.png`.

---

## Common questions

**Why is GST wrong on the PDF?**  
Update **GST No.** on the **Current Account** master linked on the invoice (`npaCurrentAc`).

**Particulars show a number instead of text**  
Save charge lines and ensure lookup enrichment provides `particularsLabel` (from **Vehicle Invoice Particulars** in Lookup Value Master). Enrichment runs in `getCrudRecordById` for child tables.

**Why is Vendor Code shown for a non-SBI case?**  
Vendor code uses the **case bank** (header), not the current-account bank. See [invoices-pdf.md](invoices-pdf.md).
