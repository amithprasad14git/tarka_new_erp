/**
 * NPA Current AC and Bill to Unit auto-fill for recovery, SARFAESI, and vehicle invoice modules.
 * Case unit id 2 → current account id 2; all other units → id 1.
 */

import { modules } from "../../config/modules";
import { hasModulePermission } from "../rbac";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";

/** Unit id that maps to the special NPA current account (id 2). */
export const INVOICE_UNIT_2_ID = 2;
/** Current account id used when case unit is INVOICE_UNIT_2_ID. */
export const INVOICE_NPA_UNIT_2_ID = 2;
/** Default current account id for all other units. */
export const INVOICE_NPA_DEFAULT_ID = 1;

/** Invoice modules that auto-fill NPA Current AC / Bill to Unit from the case. */
export const INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL = [
  "recovery_invoice",
  "sarfaesi_invoice",
  "vehicle_invoice"
];

/**
 * @param {object | null | undefined} user
 * @returns {Promise<boolean>}
 */
export async function canAccessAnyInvoiceModule(user) {
  for (const moduleKey of INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL) {
    const [canView, canCreate, canEdit] = await Promise.all([
      hasModulePermission(user, moduleKey, "view"),
      hasModulePermission(user, moduleKey, "create"),
      hasModulePermission(user, moduleKey, "edit")
    ]);
    if (canView || canCreate || canEdit) return true;
  }
  return false;
}

const EMPTY_INVOICE_CASE_AUTO_FILL = {
  npaCurrentAc: "",
  npaCurrentAcLabel: "",
  billToUnit: "",
  billToUnitLabel: ""
};

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number|string} caseId — new_case_inward.id
 * @returns {Promise<{ npaCurrentAc: string, npaCurrentAcLabel: string, billToUnit: string, billToUnitLabel: string }>}
 */
export async function resolveInvoiceNpaCurrentAcByCaseId(conn, caseId) {
  const id = Number(caseId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ...EMPTY_INVOICE_CASE_AUTO_FILL };
  }

  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const umTable = escapeSqlTableIdForModuleConfig(modules.unit_master);
  const [nciRows] = await conn.query(`SELECT unit FROM ${nciTable} WHERE id = ? LIMIT 1`, [id]);
  if (!nciRows?.length) {
    return { ...EMPTY_INVOICE_CASE_AUTO_FILL };
  }

  const unitId = Number(rowValueForField(nciRows[0], "unit"));
  let billToUnit = "";
  let billToUnitLabel = "";
  if (Number.isFinite(unitId) && unitId > 0) {
    billToUnit = String(unitId);
    const [umRows] = await conn.query(
      `SELECT unitName FROM ${umTable} WHERE id = ? LIMIT 1`,
      [unitId]
    );
    billToUnitLabel = String(rowValueForField(umRows?.[0] || {}, "unitName") ?? "").trim();
  }

  const npaId =
    unitId === INVOICE_UNIT_2_ID ? INVOICE_NPA_UNIT_2_ID : INVOICE_NPA_DEFAULT_ID;

  const camTable = escapeSqlTableIdForModuleConfig(modules.current_account_master);
  const [camRows] = await conn.query(
    `SELECT id, branch FROM ${camTable}
     WHERE id = ?
       AND LOWER(TRIM(COALESCE(active, ''))) = 'yes'
     LIMIT 1`,
    [npaId]
  );
  if (!camRows?.length) {
    return {
      npaCurrentAc: "",
      npaCurrentAcLabel: "",
      billToUnit,
      billToUnitLabel
    };
  }

  return {
    npaCurrentAc: String(npaId),
    npaCurrentAcLabel: String(rowValueForField(camRows[0], "branch") ?? "").trim(),
    billToUnit,
    billToUnitLabel
  };
}
