// Report — Audit Log Report. All SQL and filter WHERE logic for this report only.

/**
 * Audit trail rows from audit_logs with optional module/action/user filters.
 * Config: report_audit_log_report.
 */

import pool from "../db";
import { formatAuditModuleLabel } from "../auditDisplay";
import { auditJsonFullDisplay } from "../modules/auditLogs";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const AUDIT_DATETIME_FORMAT = "%d-%m-%Y %h:%i %p";

function sqlTableIds() {
  return {
    al: escapeSqlTableId("audit_logs"),
    users: escapeSqlTableId("users")
  };
}

/**
 * @param {Record<string, unknown>} filters
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildAuditLogReportWhereSql(filters) {
  const parts = [];
  const values = [];

  const from = toYyyyMmDdForSqlDateField(filters.fromDate);
  const to = toYyyyMmDdForSqlDateField(filters.toDate);
  parts.push("DATE(al.createdDate) >= ?");
  parts.push("DATE(al.createdDate) <= ?");
  values.push(from, to);

  const moduleKey = String(filters.module || "").trim();
  if (moduleKey) {
    parts.push("al.module = ?");
    values.push(moduleKey);
  }

  const action = String(filters.action || "").trim().toLowerCase();
  if (action) {
    parts.push("LOWER(TRIM(al.action)) = ?");
    values.push(action);
  }

  if (filters.user && Number.isFinite(Number(filters.user))) {
    parts.push("al.user_id = ?");
    values.push(Number(filters.user));
  }

  return { whereSql: parts.join(" AND "), values };
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    DATE_FORMAT(al.createdDate, '${AUDIT_DATETIME_FORMAT}') AS createdDate,
    u.fullName AS userLabel,
    al.module AS moduleKey,
    al.action AS action,
    al.record_label AS recordLabel,
    al.old_data AS oldData,
    al.new_data AS newData
  FROM ${t.al} al
  LEFT JOIN ${t.users} u ON u.id = al.user_id
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  void user;
  const { whereSql, values } = buildAuditLogReportWhereSql(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY al.createdDate DESC, al.id DESC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    createdDate: r.createdDate ?? "",
    userLabel: r.userLabel ?? "",
    moduleLabel: formatAuditModuleLabel(r.moduleKey),
    action: r.action ?? "",
    recordLabel: r.recordLabel ?? "",
    oldData: auditJsonFullDisplay(r.oldData),
    newData: auditJsonFullDisplay(r.newData)
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
