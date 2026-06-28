// Report — Invoice Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Union of recovery, SARFAESI, and vehicle invoices with month/dimension filters and data-type modes.
 * Config: report_invoice_ledger.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { monthEndYmd, monthStartYmd } from "./monthFilterRange";

const DATE_FORMAT = "%d-%m-%Y";
const UNIT_RESTRICT_ROLE = 2;

export const INVOICE_LEDGER_DATA_TYPE_ACTIVE = "Show Active Invoices";
export const INVOICE_LEDGER_DATA_TYPE_PENDING = "Show Pending Invoices";
export const INVOICE_LEDGER_DATA_TYPE_CANCELLED = "Show Cancelled Invoices";

const INVOICE_SOURCES = [
  { table: "recovery_invoice", receivedFk: "recoveryInvoice" },
  { table: "sarfaesi_invoice", receivedFk: "sarfaesiInvoice" },
  { table: "vehicle_invoice", receivedFk: "vehicleInvoice" }
];

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
 * @param {object} [user]
 * @param {string} [invAlias]
 * @returns {{ parts: string[], values: unknown[] }}
 */
export function buildInvoiceLedgerDimensionWhereSql(filters, user = null, invAlias = "inv") {
  const parts = [];
  const values = [];

  const month = String(filters.month || "").trim();
  const from = monthStartYmd(month);
  const to = monthEndYmd(month);
  parts.push(`DATE(${invAlias}.date) >= ?`);
  parts.push(`DATE(${invAlias}.date) <= ?`);
  values.push(from, to);

  const role = user != null ? Number(user.role) : NaN;
  if (Number.isFinite(role) && role === UNIT_RESTRICT_ROLE) {
    const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
    if (!Number.isFinite(uid)) {
      parts.push("1=0");
    } else {
      parts.push("nci.unit = ?");
      values.push(uid);
    }
  } else if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push("nci.unit = ?");
    values.push(Number(filters.unit));
  }

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

function buildInvoiceSubquery(invoiceTable, receivedFkColumn, filters, user) {
  const invTable = escapeSqlTableId(invoiceTable);
  const invAlias = "inv";
  const t = sqlTableIds();

  const dimension = buildInvoiceLedgerDimensionWhereSql(filters, user, invAlias);
  const dataType = buildInvoiceLedgerDataTypeWhereSql(filters.dataType, invAlias, receivedFkColumn);
  const whereParts = [...dimension.parts, ...dataType.parts];
  const whereValues = [...dimension.values, ...dataType.values];
  const branchLabel = branchLabelSelectSql("br", "bank");

  return {
    sql: `
  SELECT
    DATE_FORMAT(${invAlias}.date, '${DATE_FORMAT}') AS invoiceDate,
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
  INNER JOIN ${t.nci} nci ON nci.id = ${invAlias}.caseNo
  INNER JOIN ${t.um} um ON um.id = nci.unit
  INNER JOIN ${t.br} br ON br.id = nci.branch
  INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  INNER JOIN ${t.bank} bank ON bank.id = hz.bank
  LEFT JOIN ${t.cam} cam ON cam.id = ${invAlias}.npaCurrentAc
  WHERE ${whereParts.join(" AND ")}
`,
    values: whereValues
  };
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const subqueries = INVOICE_SOURCES.map(({ table, receivedFk }) =>
    buildInvoiceSubquery(table, receivedFk, filters, user)
  );

  const unionSql = subqueries.map((s) => s.sql).join(" UNION ALL ");
  const values = subqueries.flatMap((s) => s.values);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);

  const sql = `${unionSql} ORDER BY invoiceNo ASC LIMIT ?`;

  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    invoiceDate: r.invoiceDate ?? "",
    invoiceNo: r.invoiceNo ?? "",
    caseNo: r.caseNo ?? "",
    borrower: r.borrower ?? "",
    unitLabel: r.unitLabel ?? "",
    bankLabel: r.bankLabel ?? "",
    branchLabel: r.branchLabel ?? "",
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    finalInvoice: r.finalInvoice ?? "",
    grandTotal: r.grandTotal ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
