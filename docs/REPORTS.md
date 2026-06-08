# Reports (HTML view + Excel download)

Read-only reports are defined in **`config/reports.js`** — not in `config/modules.js`.

**File index:** [REPORTS-FILES.md](REPORTS-FILES.md) lists every report-related path. **Code comments:** [CODE-COMMENTS.md](CODE-COMMENTS.md) § `lib/reports`.

## Frozen framework (v1)

**Status:** **Locked — June 2026.** Validated on **New Case Inward Register** and **Branch Register**. Do not change shared styling, HTML layout, or export appearance without updating this document and the frozen theme tests.

### What is frozen (do not change per report)

| Layer | Files | Role |
|-------|-------|------|
| **Theme** | `config/reportExportTheme.js` | Fonts, colours, zebra, logo, Excel layout, HTML font presets |
| **Theme merge** | `lib/reports/applyReportExportTheme.js` | Merges theme into each report config |
| **Pipeline** | `lib/reports/report.service.js` | Auth, validation, SQL run, column visibility, totals, HTML/Excel |
| **HTML render** | `components/ReportOutputView.js` | Table, header, filter summary, footer, font toolbar |
| **HTML CSS** | `app/globals.css` (`.report-output*`) | Layout, wrapping, sticky header, scroll, dark/light rows, toolbar |
| **Column widths** | `lib/reports/htmlColumnWidths.js` | `widthHtml` → proportional `%` |
| **Column hide** | `lib/reports/resolveVisibleReportColumns.js` | `hideWhenFilterSet` when filter selected |
| **Excel build** | `lib/reports/buildReportWorkbook.js` | Logo, borders, zebra, totals row |
| **Excel logo** | `lib/reports/addReportExcelLogo.js` | Fixed pixel logo (`logoExtWidth` / `logoExtHeight`) — not stretched by column widths |
| **Custom HTML** | `components/ReportCustomOutputView.js`, `components/reports/*.js` | Opt-in bespoke layouts only |
| **Filter summary** | `lib/reports/buildFilterSummary.js`, `resolveReportFilterLabels.js` | Selected filters only, display labels |
| **UI shell** | `components/ReportModuleClient.js` | Filter form + generate; no report-specific UI |

### What each new report adds (only)

1. Entry in **`config/reports.js`** — `fields`, `columns`, optional `reportLayout.title`, `reportStyle.totalRow.labelColumn`, `filterCascade`, `hideWhenFilterSet` on columns
2. **`lib/reports/<report_key>.js`** — `runReport(user, filters, ctx)` with all SQL / `buildWhere` for that report
3. Register in **`lib/reports/reportRegistry.js`**
4. **`can_view`** in User Permissions

Do **not** duplicate styling, column-picker UI, or export logic in per-report files.

### Pipeline (fixed)

```
ReportModuleClient → GET /api/reports/<key>/run
  → report.service.js
      → validate filters
      → runner.runReport (SQL)
      → resolveVisibleReportColumns
      → computeReportTotals
      → buildFilterSummaryText
      → HTML JSON  |  buildReportWorkbook (Excel)
  → ReportOutputView (HTML only)
```

HTML and Excel always receive the **same** visible column list and totals.

### Intentionally not in scope

- Manual column show/hide UI
- Drag-to-resize columns
- localStorage / saved layouts
- Client-only column hiding
- Content-based auto column widths

### Current theme snapshot (v1 — frozen)

**Theme object** (`config/reportExportTheme.js` → `REPORT_EXPORT_THEME`):

**HTML fonts** (`html` / `htmlFontPresets` — toolbar switches preset, Excel unchanged):

| Preset | Toolbar | Table body | Title | Filter line |
|--------|---------|------------|-------|-------------|
| `small` | A− | `calc(0.65rem - 1pt)` | `calc(1.15rem - 1pt)` | `calc(0.85rem - 1pt)` |
| `normal` (default) | A | `calc(0.75rem - 1pt)` | `calc(1.25rem - 1pt)` | `calc(0.95rem - 1pt)` |
| `large` | A+ | `calc(0.85rem - 1pt)` | `calc(1.35rem - 1pt)` | `calc(1.05rem - 1pt)` |

- Table header: `calc(0.7rem)` (normal preset); footer/totals: `calc(0.75rem)` (normal preset)
- A− (`small`) uses former default A sizes (`0.65rem` table); default A uses former A+ sizes (`0.75rem`)
- Logo max height: `58px`; scroll area: `min(78vh, 40rem)`; mobile horizontal scroll: ≤1024px

**HTML layout & colours** (`app/globals.css` `.report-output*` — do not scatter report styles elsewhere):

- Card uses app theme (`var(--panel)`, `var(--text)`) — not forced white in dark mode
- **Light (enterprise v2):** zebra `#ffffff` / `#f0f4f8`; header band `#9db7c8` (black labels); totals `#9fd4ad` with top border
- **Dark:** CSS vars — subtle brand-tinted zebra, header, and totals on `var(--panel)`
- **Line-height:** `1.5` body; `1.45` header (denser rows)
- **Borders:** horizontal row lines only (no vertical grid in body); sticky header with stronger bottom edge
- **Table:** `width: 100%`, `table-layout: fixed`, sticky header, hidden scrollbars, cell wrap
- **Font toolbar:** top-right of report card when rows present — **A− / A / A+** (session-only; min/max disabled)
- **Filter panel:** collapses to a compact bar after HTML Generate (**Edit filters** / **Regenerate**)
- **Output meta:** inline with filter summary — filters left, `Generated On: DD/MM/YYYY, HH:mm · N records` right on the same row
- **Loading:** skeleton placeholder in the output area while HTML runs (Excel still uses overlay)
- **Table scroll:** hidden scrollbar; animated down-chevron while more rows below; animated up-chevron at bottom (click scrolls to top)
- **Full screen:** toolbar **⛶** shows table only (font controls + data); **✕** or **Esc** to exit
- **Cell padding:** `0.28rem 0.55rem` on table body cells (standard and custom flat tables)

**Excel** (`reportExportTheme.excel`):

- Table: 9pt; title 12pt; filter 10pt
- Logo: 2 rows `[34, 24]` height (title starts row 3); fixed size `logoExtWidth: 396`, `logoExtHeight: 58` pixels via `addReportExcelLogo.js` (`editAs: absolute` — immune to later column width changes)
- No gridlines; header/footer borders; vertical lines on data columns
- **Wrap text** on filter summary, column headers, data cells, and totals row (`buildReportWorkbook.js`)
- Zebra / totals: `#ffffff` / `#F0F4F8`; header `#9DB7C8`; total row `#9FD4AD`

### Changing frozen styling

1. Edit **`config/reportExportTheme.js`** and/or **`app/globals.css`** (`.report-output*` only).
2. Update this section’s snapshot and **`tests/jest/reportExportTheme.test.js`** (theme contract).
3. Re-check HTML on **both** light and dark app theme and Excel export on a reference report.
4. Do **not** add per-report CSS or inline report colours in `ReportOutputView` or report SQL files.

Per-report **`config/reports.js`** overrides remain limited to: `reportLayout.title`, `reportStyle.totalRow` / `sectionTotalRow`, column defs, filters.

**Grouped standard tables** (e.g. Expense Ledger Payment Mode Wise): runner returns `outputMode: "grouped"` with `groupedSections` + `grandTotal`; `ReportOutputView` and `buildReportWorkbook` render section headers and subtotals without `reportLayout.mode: custom`.

---

## Frozen export theme (HTML + Excel)

Shared styling lives in **`config/reportExportTheme.js`**. Individual report files must not set fonts, colours, borders, or layout rules — only the frozen theme and `.report-output*` CSS.

- **HTML:** `ReportOutputView` applies CSS variables from `getReportHtmlCssVars(preset)`; all visual rules in `app/globals.css` under `.report-output*`.
- **HTML font toolbar:** After generate, use **A− / A / A+** (top-right) to switch `htmlFontPresets` (`small`, `normal`, `large`). **A** is default (former A+ size); **A+** is the new largest step. Client-only, session state — does not re-run the report or affect Excel.
- **Excel:** `lib/reports/buildReportWorkbook.js` reads `exportTheme.excel` (merged via `getReportConfig()`).
- **Per-report overrides** in `config/reports.js`: only report-specific items (e.g. `reportLayout.title`, `reportStyle.totalRow.labelColumn`). Logo path and zebra colours come from the theme unless explicitly overridden.

## Adding a report

1. Add an entry to **`config/reports.js`** (`fields`, `columns`, optional `reportLayout` / `reportStyle` overrides, optional `filterCascade`).
2. Create **`lib/reports/<report_key>.js`** with `runReport(user, filters, ctx)` — all SQL and `buildWhere` logic in that file only.
3. Register the file in **`lib/reports/reportRegistry.js`**.
4. Grant **`can_view`** on the report key in User Permissions.

## Custom-layout reports (thin opt-in)

Use only when the frozen table pipeline cannot represent the layout (e.g. merged region rows, banded subtotals). **Not** a generic framework — one bespoke report at a time.

### Config

- `reportLayout.mode: "custom"`
- `reportLayout.customRenderer` — id mapped in `lib/reports/customRendererMap.js` and `components/ReportCustomOutputView.js`
- No `columns` / `reportStyle` — runner returns `{ layout: "custom", custom: { ... } }` instead of `rows`

### Runner

- **`lib/reports/<report_key>.js`** — `runReport` returns custom payload; optional `buildCustomWorkbook` export for Excel
- Per-report Excel builder under **`lib/reports/custom/<report_key>/buildCustomWorkbook.js`** when needed

### Pipeline branch (`report.service.js`)

When `reportLayout.mode === "custom"` (or runner returns `layout: "custom"`):

- Skips `resolveVisibleReportColumns`, `computeReportTotals`, `buildReportWorkbook`
- **HTML** — JSON with `layout`, `customRenderer`, `custom`, `filterSummary`
- **Excel** — calls `runner.buildCustomWorkbook(config, payload)`

### UI

- **`ReportModuleClient`** routes `layout === "custom"` to **`ReportCustomOutputView`**
- Table body in **`components/reports/<Name>.js`**
- Styles in **`app/globals.css`** under `.report-custom-output*` / `.report-custom-table*` only

### Reference implementation

**`report_region_wise_cumulative_report`** — Region Wise Cummulative Report:

- **Config:** `reportLayout.mode: "custom"`, `contentAlign: "center"` (HTML header + table centered in card)
- **Filters:** mandatory Financial Year; optional unit, bank, HO/ZO, RBO/RO, branch
- **SQL:** settled cases (final statuses except Returned) with `caseStatusUpdatedDate` in FY and `amount_recovered > 0`; grouped by RBO + loan category
- **HTML:** `ReportCustomOutputView` + `RegionWiseCumulativeReport.js`; green header band, blue subtotals, yellow grand total
- **Excel:** `lib/reports/custom/report_region_wise_cumulative_report/buildCustomWorkbook.js`
- **Helpers:** `groupRegionWiseCumulativeRows.js`, `groupCumulativeReportRows.js`, `loadFinancialYearById.js`, `formatFinancialYearRange.js`

**`report_unit_wise_cumulative_report`** — Unit Wise Cummulative Report:

- **Config:** `reportLayout.mode: "custom"`, `contentAlign: "center"`
- **Filters:** mandatory Financial Year; optional unit, bank, HO/ZO, RBO/RO, branch; **Data Type** `Month Wise` (default) | `Summary`
- **SQL:** same settled-case rules as Region Wise; grouped by calendar month + unit (Month Wise) or unit only (Summary)
- **HTML:** `ReportCustomOutputView` + `UnitWiseCumulativeReport.js` — Month Wise uses `CumulativeBandedReport`; Summary uses flat `UnitWiseSummaryReport`
- **Excel:** `lib/reports/custom/report_unit_wise_cumulative_report/buildCustomWorkbook.js` (banded or flat by Data Type)
- **Helpers:** `groupCumulativeReportRows.js`, shared `buildCumulativeBandedWorkbook.js`

**`report_sarfaesi_case_report`** — SARFAESI Case Report:

- **Config:** `reportLayout.mode: "custom"`, title `PENDING SARFAESI CASES STATUS`
- **Filters:** As on Date (required, defaults to today); optional unit, bank, HO/ZO, RBO/RO, branch, received from; report type HTML | Excel
- **SQL:** open SARFAESI loan-category cases with a `sarfaesi_case_status_update` row; `entrustmentDate <= asOnDate`; excludes `FINAL_CASE_STATUSES` (same open-case rule as Pending Cases on Hand)
- **Layout:** 4 rows per case — yellow primary header/data, blue particulars band starting under Case No; Sl. No. rowspan across data + particulars rows
- **Particulars columns:** all active `sarfaesi_case_particulars` ordered by `sequence`, then **Amount Recovered** (sum of `new_case_inward_amount_recovered`) and **Remarks** (`caseStatusRemarks`)
- **HTML:** `ReportCustomOutputView` + `SarfaesiCaseReport.js`
- **Excel:** `lib/reports/custom/report_sarfaesi_case_report/buildCustomWorkbook.js`

## Run API

`GET /api/reports/<reportKey>/run?format=html|excel&fromDate=...&...`

- **html** — JSON for on-screen table (`ReportOutputView`).
- **excel** — `.xlsx` download (same filters and data). Filename derived from report title + date range.

## Reference reports

### New Case Inward Register

- **Key:** `report_new_case_inward_register`
- **SQL:** `lib/reports/report_new_case_inward_register.js` (from `new_case_inward` + branch/bank/lookup joins)
- **Filters:** dates (month defaults), unit, bank, HO/ZO, RBO/RO, branch, loan category/type, NPA status, received from, file maintenance, report type HTML | Excel

### Branch Register

- **Key:** `report_branch_register`
- **SQL:** `lib/reports/report_branch_register.js` (from `branch_master` + bank/HO-ZO/RBO joins)
- **Filters:** bank, HO/ZO, RBO/RO, active (Yes/No or **Select One** = all), report type HTML | Excel
- **Columns:** SL NO, Bank, HO/ZO, RBO/RO, Branch Code, Branch Name, Place, Active

### Pending Cases on Hand

- **Key:** `report_pending_cases_on_hand`
- **SQL:** `lib/reports/report_pending_cases_on_hand.js` (from `new_case_inward` + branch/bank/lookup joins)
- **Filters:** As on Date (defaults to **today**), unit, bank, HO/ZO, RBO/RO, branch, received from, file maintenance, loan category/type, NPA status, report type HTML | Excel
- **Open cases only:** `caseStatus` blank or lookup label **not** in `FINAL_CASE_STATUSES` from `lib/modules/newCaseInwardCaseStatus.js` (excludes Returned and all other final statuses). Uses **current** case status; `entrustmentDate <= asOnDate`.
- **Amount Recovered:** sum of **all** `new_case_inward_amount_recovered` rows per case (not capped by As on Date).
- **Totals row:** sums Closure Balance and Amount Recovered.
- **Remarks column:** `caseStatusRemarks` from the case record.

### Part Recovered Cases

- **Key:** `report_part_recovered_cases`
- **SQL:** `lib/reports/report_part_recovered_cases.js` (from `new_case_inward` + branch/bank/lookup joins)
- **Filters:** same as Pending Cases on Hand (As on Date defaults to **today**)
- **Open cases only:** same `FINAL_CASE_STATUSES` rule as Pending Cases on Hand (excludes Returned and other final statuses)
- **Additional filter:** total **Amount Recovered** per case **> 0** (sum of all `new_case_inward_amount_recovered` rows)
- **Totals row:** sums Closure Balance and Amount Recovered
- **Display:** no Loan Category column (filter still available); Remarks = `caseStatusRemarks`

### Returned Cases

- **Key:** `report_returned_cases`
- **SQL:** `lib/reports/report_returned_cases.js` (from `new_case_inward` + branch/bank/lookup joins)
- **Filters:** From/To Date (month defaults), unit, bank, HO/ZO, RBO/RO, branch, received from, file maintenance, loan category/type, NPA status, report type HTML | Excel
- **Returned only:** `LOWER(TRIM(caseStatus lookup)) = 'returned'` — must match **Returned** in `FINAL_CASE_STATUSES`; open/ongoing cases excluded
- **Date range:** `entrustmentDate` between From and To Date
- **Amount Recovered:** sum of all `new_case_inward_amount_recovered` rows per case
- **Return Date:** `caseStatusUpdatedDate` on the case record
- **Totals row:** sums Closure Balance and Amount Recovered; Remarks = `caseStatusRemarks`

### Settled Cases

- **Key:** `report_settled_cases`
- **SQL:** `lib/reports/report_settled_cases.js` (from `new_case_inward` + branch/bank/lookup joins)
- **Filters:** From/To Date (month defaults), unit, bank, HO/ZO, RBO/RO, branch, received from, file maintenance, loan category/type, NPA status, report type HTML | Excel
- **Settled only:** case status in `FINAL_CASE_STATUSES` **except Returned** (`Closed`, `Settled under Compromise`, etc.); open/ongoing and Returned cases excluded
- **Date range:** `entrustmentDate` between From and To Date
- **Amount Recovered:** sum of all `new_case_inward_amount_recovered` rows per case
- **Settled Date:** `caseStatusUpdatedDate` on the case record
- **Case Status:** lookup label on the case record
- **Totals row:** sums Closure Balance and Amount Recovered

### Search Loan AC

- **Key:** `report_search_loan_ac`
- **SQL:** `lib/reports/report_search_loan_ac.js` (from `new_case_inward` + branch/bank/lookup joins)
- **Filters:** same as Pending Cases on Hand (As on Date defaults to **today**), plus optional text search and Data Type
- **Text search (optional):** partial match (`LIKE`) on Loan AC (`searchLoanAc`), borrower name (`searchName`), and Case No (`searchCaseNo`) — each applies only when non-empty; all active search fields are ANDed together
- **Data Type (default: All):** `All` returns **all cases regardless of case status** (no case-status predicate); `Ongoing` (open cases — same rule as Pending Cases on Hand), `Settled` (final statuses except Returned), `Returned` (Returned status only). **Deleted Cases** is not implemented in v1.
- **Date cap:** `entrustmentDate <= asOnDate` (same as Pending Cases on Hand)
- **Amount Recovered:** sum of all `new_case_inward_amount_recovered` rows per case
- **Display columns:** same as Pending Cases on Hand
- **Totals row:** sums Closure Balance and Amount Recovered

### Region Wise Cummulative Report

- **Key:** `report_region_wise_cumulative_report`
- **SQL:** `lib/reports/report_region_wise_cumulative_report.js`
- **Layout:** custom (not table pipeline) — see § Custom-layout reports
- **Filters:** Financial Year (required), unit, bank, HO/ZO, RBO/RO, branch, report type HTML | Excel
- **Metrics per RBO region × loan category:** case count, cash recovered (2 decimals), NPA reduced = `closureBalance` (2 decimals)
- **FY scope:** `caseStatusUpdatedDate` between FY start/end; settled statuses only (excludes Returned)

### Unit Wise Cummulative Report

- **Key:** `report_unit_wise_cumulative_report`
- **SQL:** `lib/reports/report_unit_wise_cumulative_report.js`
- **Layout:** custom — see § Custom-layout reports
- **Filters:** Financial Year (required), unit, bank, HO/ZO, RBO/RO, branch, **Data Type** (Month Wise | Summary), report type HTML | Excel
- **Month Wise:** 5-column banded table — month rowspan × unit rows (`unitCode - personIncharge`); metrics: case count, cash recovered, NPA reduced = `closureBalance`
- **Summary:** 4-column flat table — one row per unit (`unitCode - personIncharge`); columns: NO. OF CASES, AMOUNT RECOVERED, NPA REDUCED
- **FY scope:** `caseStatusUpdatedDate` between FY start/end; settled statuses only (excludes Returned); per-case `amount_recovered > 0`

### SARFAESI Case Report

- **Key:** `report_sarfaesi_case_report`
- **SQL:** `lib/reports/report_sarfaesi_case_report.js`
- **Layout:** custom — see § Custom-layout reports
- **Filters:** As on Date (required, defaults to **today**), unit, bank, HO/ZO, RBO/RO, branch, received from, report type HTML | Excel
- **Scope:** SARFAESI loan category only; must have `sarfaesi_case_status_update`; open cases only (`FINAL_CASE_STATUSES` excluded); `entrustmentDate <= asOnDate`
- **Particulars:** horizontal columns from active `sarfaesi_case_particulars` (sequence order); values from `sarfaesi_case_status_update_details`
- **Amount Recovered:** sum of all `new_case_inward_amount_recovered` rows per case
- **Remarks:** `caseStatusRemarks` on the case record (trailing column)

### Expense Ledger

- **Key:** `report_expense_ledger`
- **SQL:** `lib/reports/report_expense_ledger.js`
- **Layout:** standard table pipeline with optional **grouped sections** (not `mode: custom`)
- **Group:** Accounts Reports
- **Filters:** Month, optional Unit, NPA Current AC, Payment Mode, Party, Expense Category; **Data Type** (General | Payment Mode Wise | Expense Category Wise); report type HTML | Excel
- **Source:** `accounts_expense_voucher` joined to `unit_master`, `party_master`, `lookup_value_master`, `current_account_master`
- **Data Type General:** flat date-ordered rows + footer total
- **Payment Mode Wise / Expense Category Wise:** section header, detail rows, subtotal per group, grand total (HTML + Excel via extended `ReportOutputView` / `buildReportWorkbook`)
- **Role 2:** results scoped to session unit
- **Column hide:** filter-driven + `hideWhenDataType` hides grouping column when section header shows it

### Cash Deposit & Withdraw Ledger

- **Key:** `report_cash_deposit_withdraw_ledger`
- **SQL:** `lib/reports/report_cash_deposit_withdraw_ledger.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Group:** Accounts Reports
- **Filters:** Month (month picker, default current month), Transaction Type (required — Deposit or Withdraw), optional Payment Mode, NPA Current AC; report type HTML | Excel
- **Source:** `accounts_cash_deposit_withdraw` joined to `unit_master`, `current_account_master`; date range on `date` (inclusive month bounds)
- **Role 2:** results scoped to session unit (same convention as Cash Deposit & Withdraw CRUD)
- **Columns:** Voucher No, Date, Unit, Transaction Type, Payment Mode, Remarks, NPA Current AC, Cheque No/Date, In Favour Of, Amount (total row)
- **Column hide:** Transaction Type / Payment Mode / NPA Current AC hidden when matching filter is set

### Invoices Received Ledger

- **Key:** `report_invoices_received_ledger`
- **SQL:** `lib/reports/report_invoices_received_ledger.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Group:** Accounts Reports
- **Filters:** Month on **received date** (default current month), optional Unit, NPA Current AC, Bank, HO/ZO, RBO/RO, Branch; report type HTML | Excel
- **Source:** `invoices_received` joined to linked recovery/SARFAESI/vehicle invoice, `new_case_inward`, and bank hierarchy
- **Role 2:** results scoped to session unit via case join
- **Columns:** Invoice Date, Invoice No, Received Date, Ref No, Case No, Borrower, Unit, Bank, Branch, NPA Current AC, Billed Amount, TDS Less %, TDS Amount, Received Amount, Round Off (money columns totaled in footer)
- **Column hide:** Unit / Bank / Branch / NPA Current AC hidden when matching filter is set

### Invoice Ledger

- **Key:** `report_invoice_ledger`
- **SQL:** `lib/reports/report_invoice_ledger.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Group:** Accounts Reports
- **Filters:** Month (default current month), optional Unit, NPA Current AC, Bank, HO/ZO, RBO/RO, Branch; **Data Type** (Show Active Invoices | Show Pending Invoices | Show Cancelled Invoices); report type HTML | Excel
- **Source:** `recovery_invoice` UNION ALL `sarfaesi_invoice` UNION ALL `vehicle_invoice`, each joined to `new_case_inward` and bank hierarchy; month bounds on invoice `date`
- **Data Type Active:** `cancelledInvoice = No`
- **Data Type Cancelled:** `cancelledInvoice = Yes`
- **Data Type Pending:** `cancelledInvoice = No` and invoice not linked in `invoices_received` (matching recovery/sarfaesi/vehicle FK)
- **Role 2:** results scoped to session unit via case join
- **Columns:** Invoice Date, Invoice No, Case No, Borrower, Unit, Bank, Branch, NPA Current AC, Final Invoice, Grand Total (total row)
- **Column hide:** Unit / Bank / Branch / NPA Current AC hidden when matching filter is set

### Suspense AC Ledger

- **Key:** `report_suspense_ac_ledger`
- **SQL:** `lib/reports/report_suspense_ac_ledger.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Group:** Accounts Reports
- **Filters:** From/To Month (month pickers, default current month), optional Transaction Type (All | Debit | Credit), optional NPA Current AC; report type HTML | Excel
- **Source:** `accounts_suspense_entry` joined to `current_account_master`; date range on `date` (inclusive month bounds)
- **Columns:** Voucher No, Date, Transaction Type, NPA Current AC, Remarks, Amount (total row)
- **Column hide:** Transaction Type / NPA Current AC hidden when matching filter is set

### Current AC Transfer Ledger

- **Key:** `report_current_ac_transfer_ledger`
- **SQL:** `lib/reports/report_current_ac_transfer_ledger.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Group:** Accounts Reports
- **Filters:** From/To Month (month pickers, default current month), optional From Current AC, To Current AC; report type HTML | Excel
- **Source:** `accounts_current_ac_transfer` joined to `current_account_master` (from and to); date range on `date` (inclusive month bounds)
- **Columns:** Voucher No, Date, From Current AC, To Current AC, Remarks, Amount (total row)
- **Column hide:** From Current AC / To Current AC hidden when matching filter is set

### Loan Account Ledger

- **Key:** `report_loan_account_ledger`
- **SQL:** `lib/reports/report_loan_account_ledger.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Group:** Accounts Reports
- **Filters:** As on Date (cumulative — entries on or before date), optional Unit, NPA Current AC, Transaction Type (All | Receipt | Payment), Payment Mode, Party; report type HTML | Excel
- **Source:** `accounts_loan_ac` joined to `unit_master`, `party_master`, `current_account_master`; `DATE(date) <= asOnDate`
- **Role 2:** results scoped to session unit (same convention as Loan Account CRUD)
- **Columns:** Voucher No, Date, Unit, Transaction Type, Party, Remarks, Payment Mode, NPA Current AC, Cheque No/Date, In Favour Of, Receipt Amount, Payment Amount (separate columns by transaction type; both totaled in footer)
- **Column hide:** Unit / Transaction Type / Party / Payment Mode / NPA Current AC hidden when matching filter is set

### Assets & Investments Ledger

- **Key:** `report_assets_investments_ledger`
- **SQL:** `lib/reports/report_assets_investments_ledger.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Group:** Accounts Reports
- **Filters:** From/To Month (month pickers, default current month), optional Unit, Paid To, Payment Mode, NPA Current AC; report type HTML | Excel
- **Source:** `accounts_assets_investments` joined to `unit_master`, `party_master`, `current_account_master`; date range on `date` (inclusive month bounds)
- **Role 2:** results scoped to session unit (same convention as Assets & Investments CRUD)
- **Columns:** Voucher No, Date, Unit, Paid To, Remarks, Payment Mode, NPA Current AC, Cheque No/Date, In Favour Of, Amount (total row)
- **Column hide:** Unit / Paid To / Payment Mode / NPA Current AC hidden when matching filter is set

### Audit Log Report

- **Key:** `report_audit_log_report`
- **SQL:** `lib/reports/report_audit_log_report.js`
- **Layout:** standard table pipeline (`ReportOutputView` + `buildReportWorkbook`)
- **Filters:** From/To Date (month defaults), optional Module, Action, User; report type HTML | Excel
- **Source:** `audit_logs` joined to `users`; date range on `createdDate` (inclusive)
- **Module filter:** select of all CRUD module keys from `config/modules.js` (excludes `audit_logs`)
- **Action filter:** `create`, `update`, `delete`
- **Columns:** Created Date, User, Module (friendly label), Action, Record, Old Data, New Data (full JSON via `auditJsonFullDisplay`)
- **Column hide:** Module / Action / User columns hidden when the matching filter is set

## Column widths

Each column in `reports.js` should set:

- `widthExcel` — Excel column width (character units)
- `widthHtml` — optional **relative weight** for HTML (e.g. `7rem`, `2.5rem`). Values are used only as proportions — they are converted to column percentages that sum to 100%. Larger weight = wider share. Omit on columns where equal width is fine (default weight applies). The table always fills the available width (`width: 100%`); sidebar expand/collapse and window resize reflow columns via CSS. Cell text wraps within each column’s share.

Tune `widthHtml` in config if wrapping looks wrong — there is no runtime column picker or drag-resize.

On viewports **≤1024px** (tablet/mobile), the table may scroll horizontally.

## Column visibility (filter-driven)

On a column definition, set **`hideWhenFilterSet`** to the name of a report filter field (usually a lookup). When that filter has a selected value, the column is **omitted** from both HTML and Excel output — the value is already shown in the filter summary above the table.

Example: `{ key: "branchLabel", label: "BRANCH", hideWhenFilterSet: "branch", ... }` — if the user picks a branch filter, the BRANCH column is hidden.

Empty, `0`, and `'0'` are treated as no selection (column stays visible), matching legacy PHP behaviour. Columns without `hideWhenFilterSet` are always shown. There is no manual column picker.

## Permissions

Report rows in the User Permissions matrix show **View (report)** only — no Add/Edit/Delete.
