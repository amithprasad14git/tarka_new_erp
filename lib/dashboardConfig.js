// Shared library helper — resolve dashboard definitions from config/dashboards.js.

/**
 * Resolves dashboard metadata (title, permissionKey, landingWidget, etc.).
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
 * @param {string} key — dashboard config key (e.g. unit_wise_recovery_target)
 * @returns {boolean}
 */
export function isDashboardKey(key) {
  return Boolean(key && configByKey.has(key));
}

/**
 * @param {string} moduleKey — user_permissions.module value (often permissionKey)
 * @returns {boolean}
 */
export function isDashboardPermissionKey(moduleKey) {
  return Boolean(moduleKey && permissionKeySet.has(String(moduleKey).trim()));
}

/**
 * @param {string} key
 * @returns {object | null}
 */
export function getDashboardConfig(key) {
  if (!isDashboardKey(key)) return null;
  return configByKey.get(key) ?? null;
}

/** @returns {string[]} */
export function getDashboardKeys() {
  return [...configByKey.keys()];
}
