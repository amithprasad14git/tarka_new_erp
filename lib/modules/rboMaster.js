// Module-specific server rules — validations and side effects on save.

/**
 * rboMaster — business rules when records are created or updated.
 * Form fields and labels: config/modules.js
 */

// Module-specific file: rbo_master only. Do not move this logic into generic/shared files.

import { modules } from "../../config/modules";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";

/** @returns {"Yes" | "No" | ""} */
export function normalizeRboMasterActive(value) {
  const raw = value == null ? "" : String(value).trim();
  return raw === "Yes" || raw === "No" ? raw : "";
}

/**
 * True when persisted `active` on the RBO row differs from the pre-update value.
 * Used so branch_master is not rewritten on every unrelated field save.
 */
export function rboMasterActiveFieldChanged(oldRow, merged) {
  const before = normalizeRboMasterActive(oldRow?.active);
  const after = normalizeRboMasterActive(merged?.active ?? oldRow?.active);
  return before !== after && after !== "";
}

/**
 * After save on rbo_master, align branch_master.active for all branches tied to this RBO/RO.
 * Matches: UPDATE branch_master SET active = ? WHERE rbo_ro = ?
 */
export async function syncBranchMasterActiveForRbo(conn, { rboId, active }) {
  // When an RBO/RO is marked inactive, all branches under it follow the same active flag.
  const id = Number(rboId);
  if (!Number.isFinite(id) || id <= 0) return;

  const raw = active == null ? "" : String(active).trim();
  const normalized = raw === "Yes" || raw === "No" ? raw : "";
  if (!normalized) return;

  const branchTable = escapeSqlTableIdForModuleConfig(modules.branch_master);
  await conn.query(`UPDATE ${branchTable} SET \`active\` = ? WHERE \`rbo_ro\` = ?`, [normalized, id]);
}

/** Runs branch sync only when `active` actually changed on update (see rboMasterActiveFieldChanged). */
export async function syncBranchMasterActiveForRboIfActiveChanged(conn, { rboId, oldRow, merged }) {
  if (!rboMasterActiveFieldChanged(oldRow, merged)) return;
  await syncBranchMasterActiveForRbo(conn, {
    rboId,
    active: merged?.active ?? oldRow?.active
  });
}

