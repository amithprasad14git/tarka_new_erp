// Module-specific file: rules for `user_permissions` (who may receive permission rows).

import mysql from "mysql2";
import { modules } from "../../config/modules";
import { escapeSqlTableId } from "../sqlModuleTable";

function throwUserPermissionsValidation(message) {
  throw Object.assign(new Error(message), { code: "USER_PERMISSIONS_VALIDATION_FAILED" });
}

/**
 * Ensures the target user exists and is active (users.active = "Yes").
 * Use on create/update of user_permissions and before matrix save/load for a selected user.
 *
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} connOrPool
 * @param {unknown} userId
 */
export async function assertUserPermissionsTargetUserIsActive(connOrPool, userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) {
    throwUserPermissionsValidation("User is required.");
  }
  const table = modules.users?.table;
  if (!table) {
    throwUserPermissionsValidation("users module config missing.");
  }
  const ut = escapeSqlTableId(table);
  const idCol = mysql.escapeId("id");
  const activeCol = mysql.escapeId("active");
  const [rows] = await connOrPool.query(
    `SELECT ${idCol} FROM ${ut} WHERE ${idCol} = ? AND TRIM(COALESCE(${activeCol}, '')) = ? LIMIT 1`,
    [id, "Yes"]
  );
  if (!rows?.length) {
    throwUserPermissionsValidation(
      "Permissions can only be assigned to active users (Active = Yes)."
    );
  }
}

export async function applyUserPermissionsBeforeWrite(conn, { merged, oldRow }) {
  const effective = oldRow ? { ...oldRow, ...merged } : merged;
  await assertUserPermissionsTargetUserIsActive(conn, effective?.user_id);
}
