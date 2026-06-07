"use client";

// Custom report table body — SARFAESI Case Report (4 rows per case).

import { Fragment } from "react";
import { formatInrNumberForDisplay } from "../../lib/formatInrNumber";
import { formatReportCellValue } from "../../lib/formatReportCellValue";

const PRIMARY_HEADERS = [
  "Sl. No.",
  "Case No",
  "Branch",
  "Borrower",
  "Loan AC",
  "Loan Type",
  "NPA Date",
  "NPA Status",
  "Entrustment Date",
  "Closure Balance"
];

function formatDate(value) {
  return formatReportCellValue({ type: "date", dateFormat: "dd/MM/yyyy" }, value);
}

function formatInr(value) {
  const f = formatInrNumberForDisplay(value, { fixedDecimals: 2 });
  return f !== "" ? f : "";
}

function formatClosureBalance(value) {
  const f = formatInr(value);
  return f ? `Rs. ${f}` : "";
}

const TRAILING_SUB_COLUMNS = [
  { key: "amount-recovered", label: "Amount Recovered" },
  { key: "remarks", label: "Remarks" }
];

const RESERVED_SUB_COLUMN_LABELS = new Set(["amount recovered", "remarks"]);

/** @param {Array<{ id: number, label: string }>} particulars */
function buildSubColumns(particulars) {
  const master = (particulars || []).filter(
    (p) => !RESERVED_SUB_COLUMN_LABELS.has(String(p.label || "").trim().toLowerCase())
  );
  return [
    ...master.map((p) => ({
      key: `particular-${p.id}`,
      label: p.label,
      particularId: p.id
    })),
    ...TRAILING_SUB_COLUMNS.map((col) => ({ ...col, particularId: null }))
  ];
}

function subColumnValue(caseRow, col) {
  if (col.key === "amount-recovered") return formatInr(caseRow.amountRecovered);
  if (col.key === "remarks") return caseRow.caseStatusRemarks ?? "";
  const raw = caseRow.particularsById?.[col.particularId];
  return raw != null ? String(raw) : "";
}

/**
 * @param {{ custom?: object }} props
 */
export default function SarfaesiCaseReport({ custom = {} }) {
  const particulars = custom.particulars || [];
  const cases = custom.cases || [];

  if (!cases.length) {
    return <p className="report-custom-empty">No cases found for the selected filters.</p>;
  }

  const subColumns = buildSubColumns(particulars);
  const columnCount = Math.max(PRIMARY_HEADERS.length, 1 + subColumns.length);
  const remarksColIndex = subColumns.length;
  const otherColCount = Math.max(columnCount - 2, 1);
  const otherColWidth = `calc((100% - 3rem - 12rem) / ${otherColCount})`;

  return (
    <div className="report-custom-table-wrap">
      <table className="report-custom-sarfaesi-table">
        <colgroup>
          {Array.from({ length: columnCount }, (_, idx) => {
            if (idx === 0) {
              return <col key={idx} className="report-custom-sarfaesi-col-sl" />;
            }
            if (idx === remarksColIndex) {
              return <col key={idx} className="report-custom-sarfaesi-col-remarks" />;
            }
            return <col key={idx} style={{ width: otherColWidth }} />;
          })}
        </colgroup>
        <tbody>
          {cases.map((caseRow, caseIdx) => {
            const blockKey = caseRow.sarfaesiUpdateId ?? caseRow.slNo;
            const headClass =
              caseIdx > 0
                ? "report-custom-sarfaesi-primary-head report-custom-sarfaesi-case-separator"
                : "report-custom-sarfaesi-primary-head";

            return (
              <Fragment key={blockKey}>
                <tr className={headClass}>
                  {PRIMARY_HEADERS.map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
                <tr className="report-custom-sarfaesi-primary-data">
                  <td rowSpan={3} className="num-center">
                    {caseRow.slNo}
                  </td>
                  <td>{caseRow.caseNo}</td>
                  <td>{caseRow.branchLabel}</td>
                  <td>{caseRow.borrower}</td>
                  <td>{caseRow.loanAccountNo}</td>
                  <td>{caseRow.loanTypeLabel}</td>
                  <td className="num-center">{formatDate(caseRow.npaDate)}</td>
                  <td>{caseRow.npaStatusLabel}</td>
                  <td className="num-center">{formatDate(caseRow.entrustmentDate)}</td>
                  <td className="num-right">{formatClosureBalance(caseRow.closureBalance)}</td>
                </tr>
                <tr className="report-custom-sarfaesi-sub-head">
                  {subColumns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={col.key === "remarks" ? "remarks-cell" : undefined}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
                <tr className="report-custom-sarfaesi-sub-data">
                  {subColumns.map((col) => (
                    <td
                      key={col.key}
                      className={col.key === "remarks" ? "remarks-cell" : "num-center"}
                    >
                      {subColumnValue(caseRow, col)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
