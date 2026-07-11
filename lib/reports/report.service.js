// Shared report service — permission, validation, run, totals, HTML JSON or Excel.
// Frozen pipeline v1 — extend via config/reports.js + lib/reports/<key>.js only. See README.md#reports-frozen-framework.

/**
 * Central report runner used by GET /api/reports/<key>/run.
 * Standard reports: SQL → visible columns → totals → ReportOutputView or buildReportWorkbook.
 * Custom reports (reportLayout.mode = custom): SQL → custom payload → ReportCustomOutputView or buildCustomWorkbook.
 */

import { getReportConfig } from "../reportConfig";
import { hasModulePermission } from "../rbac";
import { getReportRunner } from "./reportRegistry";
import { validateReportFilters, filtersForQuery } from "./reportFilterValidation";
import { computeReportTotals } from "./computeReportTotals";
import { buildFilterSummaryText } from "./buildFilterSummary";
import { buildReportWorkbook } from "./buildReportWorkbook";
import { resolveReportFilterLabels } from "./resolveReportFilterLabels";
import { resolveVisibleReportColumns } from "./resolveVisibleReportColumns";
import { formatInstantAsMysqlDatetimeIST } from "../istDateTime";
import { countCustomReportRows } from "./countCustomReportRows.js";
import { getLockedReportUnitId } from "./reportUnitFilterLock.js";

/** Builds HTML meta (total, truncated, optional generatedAt IST). */
function buildReportHtmlMeta(config, { total, truncated }) {
  const meta = {
    total,
    truncated: Boolean(truncated)
  };
  if (config.reportLayout?.showGeneratedAt !== false) {
    meta.generatedAt = formatInstantAsMysqlDatetimeIST(new Date());
  }
  return meta;
}

/**
 * Permission-checks, validates filters, runs the report runner, and returns HTML JSON or Excel.
 * @param {object} user
 * @param {string} reportKey
 * @param {Record<string, string>} filters
 * @param {{ format: 'html' | 'excel', filterLabels?: Record<string, string> }} options
 */
export async function runReportForUser(user, reportKey, filters, options = {}) {
  const config = getReportConfig(reportKey);
  if (!config) {
    return { status: 404, body: { error: "Unknown report" } };
  }

  // Session and can_view on the report key (same permission model as modules).
  if (!user) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const canView = await hasModulePermission(user, reportKey, "view");
  if (!canView) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  // Role 2 on case reports: always scope to session unit (ignore client override).
  const lockedUnit = getLockedReportUnitId(reportKey, user.role, user.unit);
  if (lockedUnit != null) {
    filters = { ...filters, unit: String(lockedUnit) };
  }

  const runner = getReportRunner(reportKey);
  if (!runner?.runReport) {
    return { status: 500, body: { error: "Report runner not configured" } };
  }

  const validationError = validateReportFilters(config, filters, runner);
  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }

  // Run per-report SQL (lib/reports/<key>.js). outputFormat is stripped before query.
  const queryFilters = filtersForQuery(filters);
  const maxRows = Number(config.maxRows) || 50000;
  const result = await runner.runReport(user, queryFilters, { limit: maxRows });
  const isCustomLayout =
    config.reportLayout?.mode === "custom" || result?.layout === "custom";

  // Header line above table: "Unit: X | Bank: Y" (lookup labels from client when provided).
  const filterLabels = await resolveReportFilterLabels(
    config,
    filters,
    options.filterLabels || {}
  );
  const filterSummary = buildFilterSummaryText(config, filters, filterLabels);

  const format = String(options.format || "html").toLowerCase() === "excel" ? "excel" : "html";

  // Custom layout — skip table columns/totals; use bespoke HTML/Excel builders.
  if (isCustomLayout) {
    if (format === "excel") {
      const buildCustom = runner.buildCustomWorkbook;
      if (typeof buildCustom !== "function") {
        return { status: 500, body: { error: "Custom Excel builder not configured" } };
      }
      const buffer = await buildCustom(config, {
        custom: result?.custom,
        filterSummary,
        reportLayout: config.reportLayout
      });
      const fyCode =
        result?.custom?.financialYear?.yearCode ||
        String(filters.financialYear || "").replace(/-/g, "") ||
        String(filters.asOnDate || "").replace(/-/g, "");
      const nameBase = String(config.reportLayout?.title || config.label || reportKey)
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase() || "REPORT";
      const filename = `${nameBase}_${fyCode}.xlsx`.replace(/[^a-zA-Z0-9._-]+/g, "_");
      return {
        status: 200,
        excel: true,
        buffer,
        filename
      };
    }

    return {
      status: 200,
      excel: false,
      body: {
        layout: "custom",
        reportLayout: config.reportLayout,
        customRenderer: config.reportLayout?.customRenderer,
        custom: result?.custom,
        filterSummary,
        meta: buildReportHtmlMeta(config, {
          total: countCustomReportRows(result?.custom),
          truncated: result?.truncated
        })
      }
    };
  }

  // Standard table pipeline — same visible columns and totals for HTML and Excel.
  const visibleColumns = resolveVisibleReportColumns(config.columns, config.fields, filters);
  const isGrouped = result?.outputMode === "grouped";
  const groupedSections = isGrouped ? result?.groupedSections || [] : [];
  const grandTotal = isGrouped ? result?.grandTotal || {} : null;
  const rows = isGrouped ? [] : result?.rows || [];
  const totals = isGrouped ? {} : computeReportTotals(visibleColumns, rows);
  const rowCount = isGrouped
    ? groupedSections.reduce((n, s) => n + (s.rows?.length || 0), 0)
    : rows.length;

  const workbookPayload = {
    rows,
    totals,
    filterSummary,
    columns: visibleColumns,
    groupedSections: isGrouped ? groupedSections : undefined,
    grandTotal: isGrouped ? grandTotal : undefined
  };

  if (format === "excel") {
    const buffer = await buildReportWorkbook(config, workbookPayload);
    const from = String(filters.fromDate || filters.month || filters.asOnDate || "").replace(/-/g, "");
    const to = String(filters.toDate || filters.month || filters.asOnDate || "").replace(/-/g, "");
    const nameBase = String(config.reportLayout?.title || config.label || reportKey)
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase() || "REPORT";
    const filename = `${nameBase}_${from}_${to}.xlsx`.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return {
      status: 200,
      excel: true,
      buffer,
      filename
    };
  }

  return {
    status: 200,
    excel: false,
    body: {
      outputMode: result?.outputMode || "flat",
      reportLayout: config.reportLayout,
      reportStyle: config.reportStyle,
      columns: visibleColumns,
      rows,
      totals,
      groupedSections: isGrouped ? groupedSections : undefined,
      grandTotal: isGrouped ? grandTotal : undefined,
      filterSummary,
      meta: buildReportHtmlMeta(config, {
        total: rowCount,
        truncated: result?.truncated
      })
    }
  };
}

