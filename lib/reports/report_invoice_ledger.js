// Report — Invoice Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Union of recovery, SARFAESI, and vehicle invoices with month/dimension filters and data-type modes.
 * Config: report_invoice_ledger.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { monthEndYmd, monthStartYmd } from "./monthFilterRange";
import { appendInvoiceBillToUnitFilterIfSelected } from "./nciReportDimensionFilters.js";

/** MySQL DATE_FORMAT for invoice date display columns. */
export const DATE_FORMAT_INVOICE_LEDGER = "%d-%m-%Y";
/** MySQL DATE_FORMAT for month section labels in annual invoice summary. */
export const MONTH_LABEL_FORMAT_INVOICE_LEDGER = "%M-%Y";

/** Non-cancelled invoices that have a matching invoices_received row. */
export const INVOICE_LEDGER_DATA_TYPE_ACTIVE = "Show Active Invoices";
/** Non-cancelled invoices with no invoices_received row yet. */
export const INVOICE_LEDGER_DATA_TYPE_PENDING = "Show Pending Invoices";
/** Cancelled invoices only. */
export const INVOICE_LEDGER_DATA_TYPE_CANCELLED = "Show Cancelled Invoices";

/** Recovery / SARFAESI / vehicle invoice tables and their invoices_received FK columns. */
export const INVOICE_LEDGER_SOURCES = [
  { table: "recovery_invoice", receivedFk: "recoveryInvoice" },
  { table: "sarfaesi_invoice", receivedFk: "sarfaesiInvoice" },
  { table: "vehicle_invoice", receivedFk: "vehicleInvoice" }
];

/** Safe quoted table names for invoice ledger joins. */
function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    um: escapeSqlTableId("unit_master"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    cam: escapeSqlTableId("current_account_master"),
    ir: escapeSqlTableId("invoices_received")
  };
}

/**
 * @param {unknown} dataType
 * @returns {typeof INVOICE_LEDGER_DATA_TYPE_ACTIVE | typeof INVOICE_LEDGER_DATA_TYPE_PENDING | typeof INVOICE_LEDGER_DATA_TYPE_CANCELLED}
 */
export function normalizeInvoiceLedgerDataType(dataType) {
  const norm = String(dataType ?? INVOICE_LEDGER_DATA_TYPE_ACTIVE).trim();
  if (norm === INVOICE_LEDGER_DATA_TYPE_PENDING || norm === INVOICE_LEDGER_DATA_TYPE_CANCELLED) {
    return norm;
  }
  return INVOICE_LEDGER_DATA_TYPE_ACTIVE;
}

/**
 * @param {unknown} dataType
 * @param {string} invAlias
 * @param {string} receivedFkColumn
 * @returns {{ parts: string[], values: unknown[] }}
 */
export function buildInvoiceLedgerDataTypeWhereSql(dataType, invAlias, receivedFkColumn) {
  const parts = [];
  const values = [];
  const norm = normalizeInvoiceLedgerDataType(dataType);
  const t = sqlTableIds();

  if (norm === INVOICE_LEDGER_DATA_TYPE_CANCELLED) {
    parts.push(`${invAlias}.cancelledInvoice = ?`);
    values.push("Yes");
    return { parts, values };
  }

  parts.push(`${invAlias}.cancelledInvoice = ?`);
  values.push("No");

  if (norm === INVOICE_LEDGER_DATA_TYPE_PENDING) {
    parts.push(
      `NOT EXISTS (
        SELECT 1 FROM ${t.ir} ir
        WHERE ir.${receivedFkColumn} = ${invAlias}.id
          AND ir.${receivedFkColumn} IS NOT NULL
      )`
    );
  }

  return { parts, values };
}

/**
 * @param {Record<string, unknown>} filters
 * @param {string} [invAlias]
 * @param {{ from: string, to: string } | null} [dateRange]
 * @returns {{ parts: string[], values: unknown[] }}
 */
export function buildInvoiceLedgerDimensionWhereSql(filters, invAlias = "inv", dateRange = null) {
  const parts = [];
  const values = [];

  let from;
  let to;
  if (dateRange) {
    from = dateRange.from;
    to = dateRange.to;
  } else {
    const month = String(filters.month || "").trim();
    from = monthStartYmd(month);
    to = monthEndYmd(month);
  }
  parts.push(`DATE(${invAlias}.date) >= ?`);
  parts.push(`DATE(${invAlias}.date) <= ?`);
  values.push(from, to);

  appendInvoiceBillToUnitFilterIfSelected(filters, parts, values, invAlias);

  if (filters.npaCurrentAc && Number.isFinite(Number(filters.npaCurrentAc))) {
    parts.push(`${invAlias}.npaCurrentAc = ?`);
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

  return { parts, values };
}

/**
 * @param {string} invoiceTable
 * @param {string} receivedFkColumn
 * @param {Record<string, unknown>} filters
 * @param {{ dateRange?: { from: string, to: string }, includeMonthLabel?: boolean, summaryOnly?: boolean }} [options]
 * @returns {{ sql: string, values: unknown[] }}
 */
export function buildInvoiceSubquery(invoiceTable, receivedFkColumn, filters, options = {}) {
  const invTable = escapeSqlTableId(invoiceTable);
  const invAlias = "inv";
  const t = sqlTableIds();

  const dimension = buildInvoiceLedgerDimensionWhereSql(
    filters,
    invAlias,
    options.dateRange ?? null
  );
  const dataType = buildInvoiceLedgerDataTypeWhereSql(filters.dataType, invAlias, receivedFkColumn);
  const whereParts = [...dimension.parts, ...dataType.parts];
  const whereValues = [...dimension.values, ...dataType.values];

  if (options.summaryOnly) {
    return {
      sql: `
  SELECT
    cam.branch AS npaCurrentAcLabel,
    DATE_FORMAT(${invAlias}.date, '${MONTH_LABEL_FORMAT_INVOICE_LEDGER}') AS monthLabel,
    DATE_FORMAT(${invAlias}.date, '%Y-%m') AS monthKey,
    ${invAlias}.grandTotal AS grandTotal
  FROM ${invTable} ${invAlias}
  LEFT JOIN ${t.nci} nci ON nci.id = ${invAlias}.caseNo
  LEFT JOIN ${t.um} um ON um.id = ${invAlias}.billToUnit
  LEFT JOIN ${t.br} br ON br.id = nci.branch
  LEFT JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  LEFT JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  LEFT JOIN ${t.bank} bank ON bank.id = hz.bank
  LEFT JOIN ${t.cam} cam ON cam.id = ${invAlias}.npaCurrentAc
  WHERE ${whereParts.join(" AND ")}
`,
      values: whereValues
    };
  }

  const branchLabel = branchLabelSelectSql("br", "bank");
  const monthLabelSelect = options.includeMonthLabel
    ? `DATE_FORMAT(${invAlias}.date, '${MONTH_LABEL_FORMAT_INVOICE_LEDGER}') AS monthLabel,`
    : "";

  return {
    sql: `
  SELECT
    ${monthLabelSelect}
    DATE_FORMAT(${invAlias}.date, '${DATE_FORMAT_INVOICE_LEDGER}') AS invoiceDate,
    ${invAlias}.invoiceNo AS invoiceNo,
    nci.caseNo AS caseNo,
    nci.borrower AS borrower,
    um.unitName AS unitLabel,
    bank.bankCode AS bankLabel,
    ${branchLabel},
    cam.branch AS npaCurrentAcLabel,
    ${invAlias}.finalInvoice AS finalInvoice,
    ${invAlias}.grandTotal AS grandTotal
  FROM ${invTable} ${invAlias}
  LEFT JOIN ${t.nci} nci ON nci.id = ${invAlias}.caseNo
  LEFT JOIN ${t.um} um ON um.id = ${invAlias}.billToUnit
  LEFT JOIN ${t.br} br ON br.id = nci.branch
  LEFT JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  LEFT JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  LEFT JOIN ${t.bank} bank ON bank.id = hz.bank
  LEFT JOIN ${t.cam} cam ON cam.id = ${invAlias}.npaCurrentAc
  WHERE ${whereParts.join(" AND ")}
`,
    values: whereValues
  };
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} slNo
 * @param {{ includeMonthLabel?: boolean }} [options]
 */
export function mapInvoiceLedgerRow(row, slNo, options = {}) {
  const mapped = {
    slNo,
    invoiceDate: row.invoiceDate ?? "",
    invoiceNo: row.invoiceNo ?? "",
    caseNo: row.caseNo ?? "",
    borrower: row.borrower ?? "",
    unitLabel: row.unitLabel ?? "",
    bankLabel: row.bankLabel ?? "",
    branchLabel: row.branchLabel ?? "",
    npaCurrentAcLabel: row.npaCurrentAcLabel ?? "",
    finalInvoice: row.finalInvoice ?? "",
    grandTotal: row.grandTotal ?? ""
  };
  if (options.includeMonthLabel) {
    mapped.monthLabel = row.monthLabel ?? "";
  }
  return mapped;
}

/**
 * Runs Invoice Ledger (union of recovery/SARFAESI/vehicle) for the selected month.
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const subqueries = INVOICE_LEDGER_SOURCES.map(({ table, receivedFk }) =>
    buildInvoiceSubquery(table, receivedFk, filters)
  );

  const unionSql = subqueries.map((s) => s.sql).join(" UNION ALL ");
  const values = subqueries.flatMap((s) => s.values);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);

  const sql = `${unionSql} ORDER BY invoiceNo ASC LIMIT ?`;

  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => mapInvoiceLedgerRow(r, idx + 1));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}

