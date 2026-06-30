# Invoice & letter PDF printing — overview

This page lists **printable PDFs** in the ERP: three invoice types plus the **Return Case letter**.

---

## Return Case letter (not an invoice)

| | Return Case |
|---|-------------|
| **Module key** | `return_case` |
| **PDF module** | `lib/modules/returnCasePdf.js` |
| **API** | `GET /api/return-case/pdf/:id` |
| **Pages** | 3 (Office / RBO / Branch copy labels) |
| **Download name** | `RETURN_<refNo>.pdf` |
| **Child data on PDF** | Checked rows only from `return_case_details` |
| **Detailed guide** | [return-case-pdf.md](return-case-pdf.md) |

Print works like invoices: **Print** in toolbar or post-save popup → browser **download** (not a new tab).

---

## Invoice PDFs

All three invoice modules generate a **3-page A4 PDF** (Triplicate, Duplicate, Original) from the same visual language: logo, header grid, centre badge, borrower block, charges area, amount in words, current account + RCM, signatory, footer image.

Use the module guides below for invoice-specific details.

---

## Invoice comparison

| | Recovery Invoice | SARFAESI Invoice | Vehicle Invoice |
|---|------------------|------------------|-----------------|
| **Module key** | `recovery_invoice` | `sarfaesi_invoice` | `vehicle_invoice` |
| **PDF module** | `lib/modules/recoveryInvoicePdf.js` | `lib/modules/sarfaesiInvoicePdf.js` | `lib/modules/vehicleInvoicePdf.js` |
| **API** | `GET /api/recovery-invoice/pdf/:id` | `GET /api/sarfaesi-invoice/pdf/:id` | `GET /api/vehicle-invoice/pdf/:id` |
| **Charges child key** | `recovery_charges` | `sarfaesi_charges` | `vehicle_charges` |
| **Charges DB table** | `recovery_invoice_charges` | `sarfaesi_invoice_charges` | `vehicle_invoice_charges` |
| **Extra tables on PDF** | Amount recovered (from case) + charges (side by side) | Charges only (full width) | Charges only (full width) |
| **Borrower block** | Borrower, loan A/C, loan type, NPA date, account status | Borrower, loan A/C, loan type | Borrower, loan A/C, loan type |
| **Centre badge image** | `npa_recovery_invoice.png` | `npa_sarfaesi_invoice.png` → fallback recovery | `npa_vehicle_invoice.png` → fallback recovery |
| **Case filter (picker)** | Recovery cases | SARFAESI loan category | Vehicle loan category |
| **Detailed guide** | [recovery-invoice-pdf.md](recovery-invoice-pdf.md) | [sarfaesi-invoice-pdf.md](sarfaesi-invoice-pdf.md) | [vehicle-invoice-pdf.md](vehicle-invoice-pdf.md) |

---

## Shared behaviour

### Print in the UI

1. **Post-save acknowledgement** — When `postCreateAck.showPrintPdf` is `true` in `config/modules.js`, the save popup offers **Print**.
2. **Entry / view toolbar** — **Print** appears for a saved row when the user has **view** permission.
3. **Client download** — `download*InvoicePdf(recordId, refHint)` in each `*InvoiceClient.js` calls the matching API and saves `Invoice_<number>.pdf`.

### Data loading (API routes)

Each PDF route:

1. Loads the invoice row + child charge lines via `getCrudRecordById` (child lookups enriched → `particularsLabel`).
2. Loads linked **New Case Inward** by `caseNo` via `loadInvoiceLinkedCaseByCaseId` (no NCI row scope — supports cross-unit billing) for borrower and branch chain (bank, branch, RBO, place).
3. Loads **Unit** from `billToUnit` on the invoice (not from the case unit).
4. Loads **current account** from `npaCurrentAc` for GST, account block, and bank name on the remittance table.

Recovery invoice only: when `caseNo` is empty, case-linked header/borrower/recovery-details sections print blank.

### Vendor code (SBI only)

**Vendor Code** (`NPAE7138220`) is printed only when the **case bank** short code (header “Bank” from branch chain) is **SBI**, not when the current-account master bank is SBI.

### Layout constants (developers)

| Constant family | Used for |
|-----------------|----------|
| `HDR_*` | Header grid (bank, date, invoice no, GST, …) |
| `ACCOUNT_*`, `FS_ACCOUNT`, `ACCOUNT_ROW_H` | Current account block (compact: 9pt font, 18pt rows) |
| `CHARGES_COLS_MM` | Full-width charges table (SARFAESI / Vehicle only) |

Do **not** alias `HDR_*` to `ACCOUNT_*` — they are tuned independently.

### Shared assets

| Asset | Path |
|-------|------|
| Logo | `public/images/npa_full_transparent_bg.png` |
| Footer | `public/images/npa_regd_off_footer.png` |
| Fonts | `public/fonts/SamsungSharpSans-Regular.ttf`, `...-Bold.ttf` (else Helvetica) |
| Amount in words | `lib/amountInWords.js` |

---

## Tests

| Module | Unit PDF | API route |
|--------|----------|-----------|
| Return Case | `tests/jest/returnCasePdf.test.js` | `tests/jest/api.return-case-pdf.route.test.js` |
| Recovery | `tests/jest/recoveryInvoicePdf.test.js` | `tests/jest/api.recovery-invoice-pdf.route.test.js` |
| SARFAESI | `tests/jest/sarfaesiInvoicePdf.test.js` | `tests/jest/api.sarfaesi-invoice-pdf.route.test.js` |
| Vehicle | `tests/jest/vehicleInvoicePdf.test.js` | — |

---

## Which file to edit?

| Change | Edit |
|--------|------|
| PDF layout / colours / column widths | `lib/modules/<type>InvoicePdf.js` |
| What data is sent to the PDF | `app/api/<type>-invoice/pdf/[id]/route.js` |
| Print button / browser download | `lib/modules/<type>InvoiceClient.js`, `components/MasterModuleClient.js` |
| Enable Print on save popup | `config/modules.js` → `postCreateAck.showPrintPdf` |
| Particulars labels on PDF | Child lookup config + `getCrudRecordById` child enrichment (`lib/services/crud.service.js`) |
