// Shared report helper — validate filter payload before running SQL.

/**
 * Validates report filter form values (reuses CRUD field rules). outputFormat is excluded from SQL filters.
 */

import { validateCrudPayloadForWrite } from "../services/crudPayloadValidation";

/**
 * @param {object} reportConfig
 * @param {Record<string, unknown>} filters Raw filters from query/body (includes outputFormat)
 * @param {{ validateReportFilters?: (config: object, filters: Record<string, unknown>) => string | null }} [runner]
 * @returns {string | null} error message or null
 */
export function validateReportFilters(reportConfig, filters, runner = null) {
  const fields = (reportConfig?.fields || []).filter((f) => f.name !== "outputFormat");
  const pseudoModule = { fields };
  const payload = { ...filters };
  delete payload.outputFormat;

  const baseErr = validateCrudPayloadForWrite(pseudoModule, payload, "create", Object.keys(payload));
  if (baseErr) return baseErr;

  if (typeof runner?.validateReportFilters === "function") {
    return runner.validateReportFilters(reportConfig, filters);
  }
  return null;
}

/**
 * Filters passed to SQL runners (no outputFormat).
 * @param {Record<string, unknown>} filters
 * @returns {Record<string, unknown>}
 */
export function filtersForQuery(filters) {
  const out = { ...filters };
  delete out.outputFormat;
  return out;
}
