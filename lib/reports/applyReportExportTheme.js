// Shared report helper — merge frozen export theme into per-report config.

/**
 * Merges REPORT_EXPORT_THEME into each config/reports.js entry when getReportConfig() runs.
 * Per-report may override title, totalRow.labelColumn, custom layout flags only.
 * See README.md#reports-frozen-framework § Frozen framework.
 */

import { REPORT_EXPORT_THEME } from "../../config/reportExportTheme";

/**
 * @param {object | null | undefined} reportConfig Raw entry from config/reports.js
 * @returns {object | null}
 */
export function applyReportExportTheme(reportConfig) {
  if (!reportConfig) return null;

  const theme = REPORT_EXPORT_THEME;
  const layout = {
    ...theme.reportLayout,
    ...(reportConfig.reportLayout || {})
  };
  const style = {
    ...theme.reportStyle,
    ...(reportConfig.reportStyle || {}),
    zebra: {
      ...theme.reportStyle.zebra,
      ...(reportConfig.reportStyle?.zebra || {})
    },
    totalRow: {
      ...theme.reportStyle.totalRow,
      ...(reportConfig.reportStyle?.totalRow || {})
    }
  };

  return {
    ...reportConfig,
    reportLayout: layout,
    reportStyle: style,
    exportTheme: theme
  };
}

