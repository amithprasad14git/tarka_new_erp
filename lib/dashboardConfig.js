// Shared library helper — read dashboard definitions from config/dashboards.js.

/**
 * Fast lookup for dashboard keys and permission keys (used by API, RBAC matrix, layout).
 * Guide: README.md#5a-landing-dashboards
 */

import { dashboards } from "../config/dashboards";

/** @type {Set<string>} */
const permissionKeySet = new Set(
  dashboards.map((d) => String(d?.permissionKey || d?.key || "").trim()).filter(Boolean)
);

/** @type {Map<string, object>} */
const configByKey = new Map();

for (const d of dashboards) {
  const key = String(d?.key || "").trim();
  if (key) configByKey.set(key, d);
}

/**
 * True if key exists in config/dashboards.js (e.g. regional_performance).
 * @param {string} key — dashboard config key (e.g. unit_wise_recovery_target)
 * @returns {boolean}
 */
export function isDashboardKey(key) {
  return Boolean(key && configByKey.has(key));
}

/**
 * True if moduleKey is a dashboard permission (e.g. dashboard_invoice_collections).
 * @param {string} moduleKey — user_permissions.module value (often permissionKey)
 * @returns {boolean}
 */
export function isDashboardPermissionKey(moduleKey) {
  return Boolean(moduleKey && permissionKeySet.has(String(moduleKey).trim()));
}

/**
 * Returns one dashboard config object by key, or null if unknown.
 * @param {string} key
 * @returns {object | null}
 */
export function getDashboardConfig(key) {
  if (!isDashboardKey(key)) return null;
  return configByKey.get(key) ?? null;
}

/** All registered dashboard keys from config/dashboards.js. */
export function getDashboardKeys() {
  return [...configByKey.keys()];
}

