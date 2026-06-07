# Reports — file index

Quick map of every report-related source file. Behaviour and styling rules live in [REPORTS.md](REPORTS.md).

## Configuration

| File | Role |
|------|------|
| `config/reports.js` | Report registry: filters, columns, `reportLayout`, `filterCascade`, `maxRows` |
| `config/reportExportTheme.js` | Frozen HTML + Excel theme (`REPORT_EXPORT_THEME`, font presets, logo size) |

## Config resolution

| File | Role |
|------|------|
| `lib/reportConfig.js` | `getReportConfig()`, `isReportKey()` — merges theme into each report block |
| `lib/rbacMatrixReports.js` | User Permissions matrix rows for report keys |

## Pipeline (shared)

| File | Role |
|------|------|
| `lib/reports/report.service.js` | Auth, validation, run runner, table or custom branch, HTML JSON / Excel buffer |
| `lib/reports/reportRegistry.js` | Maps `report_<key>` → `lib/reports/report_<key>.js` |
| `lib/reports/reportFilterValidation.js` | Validates filter form before SQL |
| `lib/reports/reportFilterDefaults.js` | Default dates (month start/end, current month, today) for filter fields |
| `lib/reports/monthFilterRange.js` | Month picker (`YYYY-MM`) → SQL date bounds and range validation |
| `lib/reports/groupStandardLedgerSections.js` | Group flat ledger rows into sections with subtotals + grand total |
| `lib/reports/applyReportExportTheme.js` | Merges `REPORT_EXPORT_THEME` into per-report config |

## Output building

| File | Role |
|------|------|
| `lib/reports/buildReportWorkbook.js` | Standard table Excel (logo, zebra, totals) |
| `lib/reports/addReportExcelLogo.js` | Fixed-size logo in Excel (`editAs: absolute`) |
| `lib/reports/buildFilterSummary.js` | Pipe-separated filter line for report header |
| `lib/reports/resolveReportFilterLabels.js` | Lookup ids → display labels for filter summary |
| `lib/reports/resolveReportLogoFile.js` | `logoPath` → filesystem path under `public/` |
| `lib/reports/computeReportTotals.js` | Footer sums for columns with `sum: true` |
| `lib/reports/resolveVisibleReportColumns.js` | Hides columns when `hideWhenFilterSet` filter is active |
| `lib/reports/htmlColumnWidths.js` | `widthHtml` weights → column % for HTML table |
| `lib/formatReportCellValue.js` | Date / INR formatting for HTML table cells |
| `lib/reports/auditLogReportOptions.js` | Module + Action select options for Audit Log Report filters |

## Custom-layout opt-in

| File | Role |
|------|------|
| `lib/reports/customRendererMap.js` | Known `customRenderer` ids |
| `lib/reports/report_region_wise_cumulative_report.js` | SQL + `runReport` for Region Wise Cummulative |
| `lib/reports/groupRegionWiseCumulativeRows.js` | Flat SQL rows → region sections + grand total |
| `lib/reports/groupCumulativeReportRows.js` | Generic flat SQL rows → banded sections + grand total |
| `lib/reports/loadFinancialYearById.js` | FY lookup for mandatory financial year filter |
| `lib/reports/formatFinancialYearRange.js` | `YYYY - YYYY` label from FY dates |
| `lib/reports/custom/buildCumulativeBandedWorkbook.js` | Shared banded Excel for cumulative custom reports |
| `lib/reports/custom/report_region_wise_cumulative_report/buildCustomWorkbook.js` | Re-exports shared banded Excel for Region Wise |
| `lib/reports/report_unit_wise_cumulative_report.js` | SQL + `runReport` for Unit Wise Cummulative |
| `lib/reports/custom/report_unit_wise_cumulative_report/buildCustomWorkbook.js` | Excel router (Month Wise banded / Summary flat) |
| `lib/reports/custom/report_unit_wise_cumulative_report/buildSummaryWorkbook.js` | Flat Summary Excel |
| `lib/reports/report_sarfaesi_case_report.js` | SQL + `runReport` for SARFAESI Case Report |
| `lib/reports/custom/report_sarfaesi_case_report/buildCustomWorkbook.js` | 4-row-per-case Excel (yellow/blue bands) |

## Per-report SQL runners (`runReport`)

| Key | File |
|-----|------|
| `report_new_case_inward_register` | `lib/reports/report_new_case_inward_register.js` |
| `report_branch_register` | `lib/reports/report_branch_register.js` |
| `report_pending_cases_on_hand` | `lib/reports/report_pending_cases_on_hand.js` |
| `report_part_recovered_cases` | `lib/reports/report_part_recovered_cases.js` |
| `report_returned_cases` | `lib/reports/report_returned_cases.js` |
| `report_settled_cases` | `lib/reports/report_settled_cases.js` |
| `report_search_loan_ac` | `lib/reports/report_search_loan_ac.js` |
| `report_region_wise_cumulative_report` | `lib/reports/report_region_wise_cumulative_report.js` |
| `report_unit_wise_cumulative_report` | `lib/reports/report_unit_wise_cumulative_report.js` |
| `report_sarfaesi_case_report` | `lib/reports/report_sarfaesi_case_report.js` |
| `report_audit_log_report` | `lib/reports/report_audit_log_report.js` |
| `report_assets_investments_ledger` | `lib/reports/report_assets_investments_ledger.js` |
| `report_cash_deposit_withdraw_ledger` | `lib/reports/report_cash_deposit_withdraw_ledger.js` |
| `report_expense_ledger` | `lib/reports/report_expense_ledger.js` |
| `report_loan_account_ledger` | `lib/reports/report_loan_account_ledger.js` |
| `report_current_ac_transfer_ledger` | `lib/reports/report_current_ac_transfer_ledger.js` |
| `report_suspense_ac_ledger` | `lib/reports/report_suspense_ac_ledger.js` |
| `report_invoice_ledger` | `lib/reports/report_invoice_ledger.js` |
| `report_invoices_received_ledger` | `lib/reports/report_invoices_received_ledger.js` |

## UI

| File | Role |
|------|------|
| `components/ReportModuleClient.js` | Filter form, Generate, routes HTML to table or custom view |
| `components/ReportOutputView.js` | Frozen v1 HTML table + font toolbar |
| `components/ReportCustomOutputView.js` | Custom report shell (logo, title, FY, centered layout opt-in) |
| `components/reports/RegionWiseCumulativeReport.js` | Region Wise Cummulative table body |
| `components/reports/CumulativeBandedReport.js` | Shared banded cumulative table body |
| `components/reports/UnitWiseCumulativeReport.js` | Unit Wise router (Month Wise / Summary) |
| `components/reports/UnitWiseSummaryReport.js` | Unit Wise Summary flat table body |
| `components/reports/SarfaesiCaseReport.js` | SARFAESI Case Report 4-row-per-case table body |
| `app/globals.css` | `.report-output*` (table reports), `.report-custom-*` (custom reports) |

## API

| File | Role |
|------|------|
| `app/api/reports/[module]/run/route.js` | `GET` — query filters, `format=html|excel` |

## Tests (report)

| File | Covers |
|------|--------|
| `tests/jest/reportConfig.test.js` | Report keys and theme merge |
| `tests/jest/reportExportTheme.test.js` | Frozen theme contract |
| `tests/jest/addReportExcelLogo.test.js` | Excel logo row block |
| `tests/jest/buildReportWorkbook.test.js` | Excel alignment helper |
| `tests/jest/reportRegionWiseCumulativeReport.test.js` | Custom report config + grouping |
| `tests/jest/report*.test.js` | Per-report config and SQL helpers |
| `tests/jest/buildFilterSummary.test.js` | Filter summary text |
| `tests/jest/computeReportTotals.test.js` | Footer totals |
| `tests/jest/resolveVisibleReportColumns.test.js` | Column hide when filter set |
