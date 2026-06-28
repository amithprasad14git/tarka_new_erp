/**
 * NPA Current AC auto-fill for recovery, SARFAESI, and vehicle invoice modules.
 * Case unit id 2 → current account id 2; all other units → id 1.
 */

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";

export const INVOICE_UNIT_2_ID = 2;
export const INVOICE_NPA_UNIT_2_ID = 2;
export const INVOICE_NPA_DEFAULT_ID = 1;

export const INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL = [
  "recovery_invoice",
  "sarfaesi_invoice",
  "vehicle_invoice"
];

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number|string} caseId — new_case_inward.id
 * @returns {Promise<{ npaCurrentAc: string, npaCurrentAcLabel: string }>}
 */
export async function resolveInvoiceNpaCurrentAcByCaseId(conn, caseId) {
  const id = Number(caseId);
  if (!Number.isFinite(id) || id <= 0) {
    return { npaCurrentAc: "", npaCurrentAcLabel: "" };
  }

  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const [nciRows] = await conn.query(`SELECT unit FROM ${nciTable} WHERE id = ? LIMIT 1`, [id]);
  if (!nciRows?.length) {
    return { npaCurrentAc: "", npaCurrentAcLabel: "" };
  }

  const unitId = Number(rowValueForField(nciRows[0], "unit"));
  const npaId =
    unitId === INVOICE_UNIT_2_ID ? INVOICE_NPA_UNIT_2_ID : INVOICE_NPA_DEFAULT_ID;

  const camTable = escapeSqlTableIdForModuleConfig(modules.current_account_master);
  const [camRows] = await conn.query(`SELECT id, branch FROM ${camTable} WHERE id = ? LIMIT 1`, [npaId]);
  if (!camRows?.length) {
    return { npaCurrentAc: String(npaId), npaCurrentAcLabel: "" };
  }

  return {
    npaCurrentAc: String(npaId),
    npaCurrentAcLabel: String(rowValueForField(camRows[0], "branch") ?? "").trim()
  };
}
