// Shared report helper — human-readable filter lines for report header.

/**
 * Builds "Unit: X | Bank: Y" line shown under the report title (HTML and Excel).
 * Skips empty filters and fields in reportLayout.filterSummaryExcludeFields.
 */

import { formatReportDateDisplay } from "../formatReportDateDisplay";

/** Formats a date filter value for the summary line. */
function formatDateDisplay(value) {
  return formatReportDateDisplay(value);
}

/** Formats YYYY-MM month filters as MM/YYYY for the summary line. */
function formatMonthDisplay(value) {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return s;
  return `${m[2]}/${m[1]}`;
}

/** True when a filter should be omitted from the summary (empty / invalid lookup). */
function isFilterEmpty(value, field) {
  if (value == null || value === "") return true;
  if (field?.type === "lookup") return !Number.isFinite(Number(value));
  return String(value).trim() === "";
}

/**
 * Builds the human-readable filter summary line under the report title.
 * @param {object} reportConfig
 * @param {Record<string, unknown>} filters Includes lookup ids; optional label map from client
 * @param {Record<string, string>} [labelByField] Display text for lookup filters
 * @returns {string}
 */
export function buildFilterSummaryText(reportConfig, filters, labelByField = {}) {
  const layout = reportConfig?.reportLayout || {};
  const exclude = new Set(layout.filterSummaryExcludeFields || ["outputFormat"]);
  const parts = [];

  for (const f of reportConfig?.fields || []) {
    if (exclude.has(f.name)) continue;
    const raw = filters[f.name];
    if (isFilterEmpty(raw, f)) continue;
    if (f.type === "date") {
      parts.push(`${f.label}: ${formatDateDisplay(raw)}`);
      continue;
    }
    if (f.type === "month") {
      parts.push(`${f.label}: ${formatMonthDisplay(raw)}`);
      continue;
    }
    if (f.type === "lookup") {
      const label = labelByField[f.name];
      if (label && String(label).trim()) {
        parts.push(`${f.label}: ${String(label).trim()}`);
      }
      continue;
    }
    if (f.type === "select" && Array.isArray(f.options)) {
      const opt = f.options.find((o) => String(o.value) === String(raw));
      parts.push(`${f.label}: ${opt?.label ?? raw}`);
      continue;
    }
    parts.push(`${f.label}: ${raw}`);
  }

  return parts.join(" | ");
}

