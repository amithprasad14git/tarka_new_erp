// Dashboard — Invoice Collections FY aggregation for chart widgets.

/**
 * Sums billed/received invoices across recovery, SARFAESI, and vehicle sources for the active FY.
 * Powers KPI grid, by-bank pie, and drilldown modal. Guide: docs/DASHBOARDS.md
 */

import pool from "../../db";
import { escapeSqlTableId } from "../../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../../sqlDateFieldValue";
import { buildInvoiceLedgerDataTypeWhereSql } from "../../reports/report_invoice_ledger.js";
import { INVOICE_LEDGER_DATA_TYPE_PENDING } from "../../reports/report_invoice_ledger.js";
import { INVOICE_SOURCES } from "./invoiceSources.js";

/** Safe quoted table names for invoice + case joins. */
function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    um: escapeSqlTableId("unit_master"),
    ir: escapeSqlTableId("invoices_received"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master")
  };
}

/** Builds `?, ?, ?` placeholders for IN (unitIds). */
function unitInClause(unitCount) {
  return unitCount > 0 ? Array(unitCount).fill("?").join(", ") : "?";
}

/**
 * Converts FY start/end to SQL date strings for invoice date filters.
 * @param {{ startDate: string, endDate: string }} fy
 */
function fyBounds(fy) {
  return {
    from: toYyyyMmDdForSqlDateField(fy.startDate),
    to: toYyyyMmDdForSqlDateField(fy.endDate)
  };
}

/**
 * Percentage of FY received over FY billed (0–100), for the Collected KPI.
 * @param {number} billed
 * @param {number} received
 */
export function computeCollectedPct(billed, received) {
  const b = Number(billed);
  const r = Number(received);
  if (!Number.isFinite(b) || b <= 0) return 0;
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.max(0, Math.min(100, (r / b) * 100));
}

/**
 * FY grandTotal per invoice type (recovery / SARFAESI / vehicle).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadBilledByType(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const results = [];

  for (const src of INVOICE_SOURCES) {
    const invTable = escapeSqlTableId(src.table);
    const sql = `
SELECT COALESCE(SUM(inv.grandTotal), 0) AS billed
FROM ${invTable} inv
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
WHERE nci.unit IN (${placeholders})
  AND inv.cancelledInvoice = 'No'
  AND DATE(inv.date) >= ?
  AND DATE(inv.date) <= ?`;
    const [rows] = await pool.query(sql, [...unitIds, from, to]);
    results.push({
      typeKey: src.typeKey,
      typeLabel: src.typeLabel,
      billed: Number(rows?.[0]?.billed) || 0
    });
  }

  return results;
}

/**
 * FY receivedAmount per invoice type from invoices_received lines.
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadReceivedByType(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const results = [];

  for (const src of INVOICE_SOURCES) {
    const invTable = escapeSqlTableId(src.table);
    const sql = `
SELECT COALESCE(SUM(ir.receivedAmount), 0) AS received
FROM ${t.ir} ir
INNER JOIN ${invTable} inv ON inv.id = ir.${src.receivedFk}
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
WHERE nci.unit IN (${placeholders})
  AND DATE(ir.receivedDate) >= ?
  AND DATE(ir.receivedDate) <= ?`;
    const [rows] = await pool.query(sql, [...unitIds, from, to]);
    results.push({
      typeKey: src.typeKey,
      typeLabel: src.typeLabel,
      received: Number(rows?.[0]?.received) || 0
    });
  }

  return results;
}

/**
 * Company-wide FY received + TDS totals (all invoice sources combined).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadReceivedTotals(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const unionParts = INVOICE_SOURCES.map((src) => {
    const invTable = escapeSqlTableId(src.table);
    return `
SELECT ir.receivedAmount, ir.tdsAmount
FROM ${t.ir} ir
INNER JOIN ${invTable} inv ON inv.id = ir.${src.receivedFk}
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
WHERE nci.unit IN (${placeholders})
  AND DATE(ir.receivedDate) >= ?
  AND DATE(ir.receivedDate) <= ?`;
  });

  const values = [];
  for (let i = 0; i < INVOICE_SOURCES.length; i += 1) {
    values.push(...unitIds, from, to);
  }

  const sql = `
SELECT
  COALESCE(SUM(x.receivedAmount), 0) AS received,
  COALESCE(SUM(x.tdsAmount), 0) AS tds
FROM (${unionParts.join(" UNION ALL ")}) x`;

  const [rows] = await pool.query(sql, values);
  return {
    received: Number(rows?.[0]?.received) || 0,
    tds: Number(rows?.[0]?.tds) || 0
  };
}

/**
 * Invoices billed in FY with no matching received line (pending count + amount).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadPendingInvoices(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const unionParts = [];
  const values = [];

  for (const src of INVOICE_SOURCES) {
    const invTable = escapeSqlTableId(src.table);
    const dataType = buildInvoiceLedgerDataTypeWhereSql(
      INVOICE_LEDGER_DATA_TYPE_PENDING,
      "inv",
      src.receivedFk
    );
    unionParts.push(`
SELECT inv.grandTotal AS grandTotal
FROM ${invTable} inv
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
WHERE nci.unit IN (${placeholders})
  AND DATE(inv.date) >= ?
  AND DATE(inv.date) <= ?
  AND ${dataType.parts.join(" AND ")}`);
    values.push(...unitIds, from, to, ...dataType.values);
  }

  const sql = `
SELECT COUNT(*) AS pendingCount, COALESCE(SUM(x.grandTotal), 0) AS pendingAmount
FROM (${unionParts.join(" UNION ALL ")}) x`;

  const [rows] = await pool.query(sql, values);
  return {
    count: Number(rows?.[0]?.pendingCount) || 0,
    amount: Number(rows?.[0]?.pendingAmount) || 0
  };
}

/**
 * FY billed amount grouped by bank — feeds the by-bank pie chart.
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadBilledByBank(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const unionParts = INVOICE_SOURCES.map((src) => {
    const invTable = escapeSqlTableId(src.table);
    return `
SELECT
  bank.id AS bankId,
  CONCAT(bank.bankCode, ' - ', bank.bankName) AS bankLabel,
  inv.grandTotal AS billed
FROM ${invTable} inv
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
INNER JOIN ${t.br} br ON br.id = nci.branch
INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
INNER JOIN ${t.bank} bank ON bank.id = hz.bank
WHERE nci.unit IN (${placeholders})
  AND inv.cancelledInvoice = 'No'
  AND DATE(inv.date) >= ?
  AND DATE(inv.date) <= ?
  AND bank.active = 'Yes'`;
  });

  const values = [];
  for (let i = 0; i < INVOICE_SOURCES.length; i += 1) {
    values.push(...unitIds, from, to);
  }

  const sql = `
SELECT
  x.bankId AS bankId,
  x.bankLabel AS bankLabel,
  COALESCE(SUM(x.billed), 0) AS billed
FROM (${unionParts.join(" UNION ALL ")}) x
GROUP BY x.bankId, x.bankLabel
HAVING billed > 0
ORDER BY x.bankLabel`;

  const [rawRows] = await pool.query(sql, values);
  return (rawRows || []).map((r) => ({
    bankId: Number(r.bankId) || 0,
    bankLabel: String(r.bankLabel ?? ""),
    billed: Number(r.billed) || 0
  }));
}

/**
 * Count of distinct invoice headers billed in FY (all sources).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadBilledInvoiceCount(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const unionParts = INVOICE_SOURCES.map((src) => {
    const invTable = escapeSqlTableId(src.table);
    return `
SELECT inv.id
FROM ${invTable} inv
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
WHERE nci.unit IN (${placeholders})
  AND inv.cancelledInvoice = 'No'
  AND DATE(inv.date) >= ?
  AND DATE(inv.date) <= ?`;
  });

  const values = [];
  for (let i = 0; i < INVOICE_SOURCES.length; i += 1) {
    values.push(...unitIds, from, to);
  }

  const sql = `SELECT COUNT(*) AS cnt FROM (${unionParts.join(" UNION ALL ")}) x`;
  const [rows] = await pool.query(sql, values);
  return Number(rows?.[0]?.cnt) || 0;
}

/**
 * Count of invoices_received lines in FY (all sources).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadReceivedLineCount(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const unionParts = INVOICE_SOURCES.map((src) => {
    const invTable = escapeSqlTableId(src.table);
    return `
SELECT ir.id
FROM ${t.ir} ir
INNER JOIN ${invTable} inv ON inv.id = ir.${src.receivedFk}
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
WHERE nci.unit IN (${placeholders})
  AND DATE(ir.receivedDate) >= ?
  AND DATE(ir.receivedDate) <= ?`;
  });

  const values = [];
  for (let i = 0; i < INVOICE_SOURCES.length; i += 1) {
    values.push(...unitIds, from, to);
  }

  const sql = `SELECT COUNT(*) AS cnt FROM (${unionParts.join(" UNION ALL ")}) x`;
  const [rows] = await pool.query(sql, values);
  return Number(rows?.[0]?.cnt) || 0;
}

/**
 * Month-by-month FY cash received — column chart data for drilldown / future use.
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
export async function loadMonthWiseReceived(unitIds, fy) {
  const t = sqlTableIds();
  const { from, to } = fyBounds(fy);
  const placeholders = unitInClause(unitIds.length);
  const unionParts = INVOICE_SOURCES.map((src) => {
    const invTable = escapeSqlTableId(src.table);
    return `
SELECT ir.receivedDate, ir.receivedAmount
FROM ${t.ir} ir
INNER JOIN ${invTable} inv ON inv.id = ir.${src.receivedFk}
INNER JOIN ${t.nci} nci ON nci.id = inv.caseNo
WHERE nci.unit IN (${placeholders})
  AND DATE(ir.receivedDate) >= ?
  AND DATE(ir.receivedDate) <= ?`;
  });

  const values = [];
  for (let i = 0; i < INVOICE_SOURCES.length; i += 1) {
    values.push(...unitIds, from, to);
  }

  const sql = `
SELECT
  DATE_FORMAT(x.receivedDate, '%Y-%m') AS monthKey,
  CONCAT(DATE_FORMAT(x.receivedDate, '%b'), '-', DATE_FORMAT(x.receivedDate, '%Y')) AS monthLabel,
  COALESCE(SUM(x.receivedAmount), 0) AS amountReceived
FROM (${unionParts.join(" UNION ALL ")}) x
GROUP BY monthKey, monthLabel
ORDER BY monthKey`;

  const [rawRows] = await pool.query(sql, values);
  return (rawRows || []).map((r) => ({
    monthKey: r.monthKey ?? "",
    monthLabel: r.monthLabel ?? "",
    amountRecovered: Number(r.amountReceived) || 0
  }));
}

/**
 * Main export — runs all invoice SQL queries in parallel and merges KPI payload.
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string, yearCode?: string, yearRangeLabel?: string }} fy
 */
export async function aggregateInvoiceCollections(unitIds, fy) {
  const [
    billedRows,
    receivedByTypeRows,
    receivedTotals,
    pending,
    monthWiseReceived,
    billedCount,
    receivedCount,
    byBankRows
  ] = await Promise.all([
    loadBilledByType(unitIds, fy),
    loadReceivedByType(unitIds, fy),
    loadReceivedTotals(unitIds, fy),
    loadPendingInvoices(unitIds, fy),
    loadMonthWiseReceived(unitIds, fy),
    loadBilledInvoiceCount(unitIds, fy),
    loadReceivedLineCount(unitIds, fy),
    loadBilledByBank(unitIds, fy)
  ]);

  const receivedMap = Object.fromEntries(receivedByTypeRows.map((r) => [r.typeKey, r.received]));
  const byType = billedRows.map((b) => ({
    typeKey: b.typeKey,
    typeLabel: b.typeLabel,
    billed: b.billed,
    received: receivedMap[b.typeKey] ?? 0
  }));

  const billed = byType.reduce((s, r) => s + r.billed, 0);
  const received = receivedTotals.received;
  const outstanding = Math.max(0, billed - received);

  return {
    financialYear: {
      yearCode: fy.yearCode ?? "",
      yearRangeLabel: fy.yearRangeLabel ?? ""
    },
    totals: {
      billed,
      received,
      outstanding,
      tds: receivedTotals.tds,
      collectedPct: computeCollectedPct(billed, received)
    },
    pending,
    byType,
    byBank: byBankRows,
    monthWiseReceived,
    counts: {
      billed: billedCount,
      received: receivedCount
    }
  };
}
