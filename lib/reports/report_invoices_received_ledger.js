// Report — Invoices Received Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Ledger rows from invoices_received with linked invoice/case/bank dimensions.
 * Config: report_invoices_received_ledger, report_annual_invoices_received_ledger.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { monthEndYmd, monthStartYmd } from "./monthFilterRange";
import { appendInvoicesReceivedBillToUnitFilterIfSelected } from "./nciReportDimensionFilters.js";

const DATE_FORMAT = "%d-%m-%Y";
/** MySQL DATE_FORMAT for month section labels in annual received summary. */
export const MONTH_LABEL_FORMAT_INVOICES_RECEIVED = "%M-%Y";

/** Safe quoted table names for invoices-received ledger joins. */
function sqlTableIds() {
  return {
    ir: escapeSqlTableId("invoices_received"),
    ri: escapeSqlTableId("recovery_invoice"),
    si: escapeSqlTableId("sarfaesi_invoice"),
    vi: escapeSqlTableId("vehicle_invoice"),
    nci: escapeSqlTableId("new_case_inward"),
    um: escapeSqlTableId("unit_master"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    cam: escapeSqlTableId("current_account_master")
  };
}

/**
 * FROM/JOIN linking invoices_received to recovery/SARFAESI/vehicle invoices and case hierarchy.
 * @returns {string}
 */
function buildFromJoinSql() {
  const t = sqlTableIds();
  return `
  FROM ${t.ir} ir
  LEFT JOIN ${t.ri} ri ON ri.id = ir.recoveryInvoice
  LEFT JOIN ${t.si} si ON si.id = ir.sarfaesiInvoice
  LEFT JOIN ${t.vi} vi ON vi.id = ir.vehicleInvoice
  LEFT JOIN ${t.nci} nci ON nci.id = COALESCE(ri.caseNo, si.caseNo, vi.caseNo)
  LEFT JOIN ${t.um} um ON um.id = COALESCE(ri.billToUnit, si.billToUnit, vi.billToUnit)
  LEFT JOIN ${t.br} br ON br.id = nci.branch
  LEFT JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  LEFT JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  LEFT JOIN ${t.bank} bank ON bank.id = hz.bank
  LEFT JOIN ${t.cam} cam ON cam.id = COALESCE(ri.npaCurrentAc, si.npaCurrentAc, vi.npaCurrentAc)
`;
}

/**
 * @param {Record<string, unknown>} filters
 * @param {{ from: string, to: string } | null} [dateRange]
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildInvoicesReceivedLedgerWhereSql(filters, dateRange = null) {
  const parts = [];
  const values = [];

  if (dateRange?.from && dateRange?.to) {
    parts.push("DATE(ir.receivedDate) >= ?");
    parts.push("DATE(ir.receivedDate) <= ?");
    values.push(dateRange.from, dateRange.to);
  } else {
    const month = String(filters.month || "").trim();
    const from = monthStartYmd(month);
    const to = monthEndYmd(month);
    parts.push("DATE(ir.receivedDate) >= ?");
    parts.push("DATE(ir.receivedDate) <= ?");
    values.push(from, to);
  }

  appendInvoicesReceivedBillToUnitFilterIfSelected(filters, parts, values);

  if (filters.npaCurrentAc && Number.isFinite(Number(filters.npaCurrentAc))) {
    parts.push("COALESCE(ri.npaCurrentAc, si.npaCurrentAc, vi.npaCurrentAc) = ?");
    values.push(Number(filters.npaCurrentAc));
  }

  if (filters.bank && Number.isFinite(Number(filters.bank))) {
    parts.push("bank.id = ?");
    values.push(Number(filters.bank));
  }
  if (filters.ho_zo && Number.isFinite(Number(filters.ho_zo))) {
    parts.push("hz.id = ?");
    values.push(Number(filters.ho_zo));
  }
  if (filters.rbo_ro && Number.isFinite(Number(filters.rbo_ro))) {
    parts.push("rbo.id = ?");
    values.push(Number(filters.rbo_ro));
  }
  if (filters.branch && Number.isFinite(Number(filters.branch))) {
    parts.push("nci.branch = ?");
    values.push(Number(filters.branch));
  }

  return { whereSql: parts.join(" AND "), values };
}

/** Detail SELECT for invoices received ledger rows. */
function buildSelectSql() {
  const branchLabel = branchLabelSelectSql("br", "bank");
  return `
  SELECT
    DATE_FORMAT(COALESCE(ri.date, si.date, vi.date), '${DATE_FORMAT}') AS invoiceDate,
    COALESCE(ri.invoiceNo, si.invoiceNo, vi.invoiceNo) AS invoiceNo,
    DATE_FORMAT(ir.receivedDate, '${DATE_FORMAT}') AS receivedDate,
    ir.refNo AS refNo,
    nci.caseNo AS caseNo,
    nci.borrower AS borrower,
    um.unitName AS unitLabel,
    bank.bankCode AS bankLabel,
    ${branchLabel},
    cam.branch AS npaCurrentAcLabel,
    ir.billedAmount AS billedAmount,
    ir.tdsPercentage AS tdsPercentage,
    ir.tdsAmount AS tdsAmount,
    ir.receivedAmount AS receivedAmount,
    ir.roundOff AS roundOff
  ${buildFromJoinSql()}
`;
}

/**
 * Summary SELECT (NPA AC + month + amounts) — reused by annual received ledger.
 * @returns {string}
 */
export function buildInvoicesReceivedSummarySelectSql() {
  return `
  SELECT
    cam.branch AS npaCurrentAcLabel,
    DATE_FORMAT(ir.receivedDate, '${MONTH_LABEL_FORMAT_INVOICES_RECEIVED}') AS monthLabel,
    DATE_FORMAT(ir.receivedDate, '%Y-%m') AS monthKey,
    ir.billedAmount AS billedAmount,
    ir.tdsAmount AS tdsAmount,
    ir.receivedAmount AS receivedAmount
  ${buildFromJoinSql()}
`;
}

/**
 * Runs Invoices Received Ledger for the selected month.
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildInvoicesReceivedLedgerWhereSql(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY ir.receivedDate ASC, ir.refNo ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    invoiceDate: r.invoiceDate ?? "",
    invoiceNo: r.invoiceNo ?? "",
    receivedDate: r.receivedDate ?? "",
    refNo: r.refNo ?? "",
    caseNo: r.caseNo ?? "",
    borrower: r.borrower ?? "",
    unitLabel: r.unitLabel ?? "",
    bankLabel: r.bankLabel ?? "",
    branchLabel: r.branchLabel ?? "",
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    billedAmount: r.billedAmount ?? "",
    tdsPercentage: r.tdsPercentage ?? "",
    tdsAmount: r.tdsAmount ?? "",
    receivedAmount: r.receivedAmount ?? "",
    roundOff: r.roundOff ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}

