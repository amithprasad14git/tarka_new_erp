// Shared library helper — resolve report definitions from config/reports.js.

/**
 * Resolves report blocks from config/reports.js and merges the frozen export theme
 * (config/reportExportTheme.js via applyReportExportTheme). Used by UI, API, and RBAC matrix.
 */

import { reports } from "../config/reports";
import { applyReportExportTheme } from "./reports/applyReportExportTheme";

/** @type {Map<string, object>} */
const mergedConfigCache = new Map();

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isReportKey(key) {
  return Boolean(key && Object.prototype.hasOwnProperty.call(reports, key));
}

/**
 * @param {string} key
 * @returns {object | null} Report config merged with frozen export theme (HTML + Excel).
 */
export function getReportConfig(key) {
  if (!isReportKey(key)) return null;
  if (!mergedConfigCache.has(key)) {
    mergedConfigCache.set(key, applyReportExportTheme(reports[key]));
  }
  return mergedConfigCache.get(key);
}

/** @returns {string[]} */
export function getReportKeys() {
  return Object.keys(reports);
}

