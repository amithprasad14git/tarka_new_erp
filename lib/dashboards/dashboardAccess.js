// Shared dashboard access — who may see a landing widget or call its API.

/**
 * Permission rules for config/dashboards.js entries.
 * Admin always allowed; others need an explicit user_permissions matrix row.
 * Guide: README.md#5a-landing-dashboards
 */

import { hasAnyModuleAccess } from "../rbac";
import { getDashboardConfig } from "../dashboardConfig";
import { dashboards } from "../../config/dashboards";

/**
 * Whether the user may see/use a dashboard (landing widget, card, API).
 *
 * - Role 1 admin: always allowed
 * - Explicit `user_permissions` row with any CRUD flag on permissionKey: allowed
 *
 * @param {object | null} user
 * @param {string} dashboardKey
 * @returns {Promise<boolean>}
 */
export async function canAccessDashboard(user, dashboardKey) {
  if (!user) return false;
  if (Number(user.role) === 1) return true;

  const config = getDashboardConfig(dashboardKey);
  if (!config) return false;

  const permissionKey = String(config.permissionKey || config.key || "").trim();

  if (permissionKey && (await hasAnyModuleAccess(user, permissionKey))) {
    return true;
  }

  return false;
}

/**
 * Same as canAccessDashboard but accepts permissionKey directly (used by layout filter).
 * @param {object | null} user
 * @param {string} permissionKey — user_permissions.module value
 * @returns {Promise<boolean>}
 */
export async function canAccessDashboardByPermissionKey(user, permissionKey) {
  const key = String(permissionKey || "").trim();
  if (!key) return false;

  const match = dashboards.find(
    (d) => String(d.permissionKey || d.key || "").trim() === key
  );
  if (!match?.key) return hasAnyModuleAccess(user, key);
  return canAccessDashboard(user, match.key);
}

