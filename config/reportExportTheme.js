// Frozen HTML + Excel export styling for all reports. Change only with deliberate review.
//
// Framework v1 — locked June 2026 (NCI + Branch Register). See README.md#reports-frozen-framework § Frozen framework.

/**
 * Shared theme — per-report `reportLayout` / `reportStyle` in config/reports.js may override
 * layout text (title, logo) and report-specific total row column only.
 */
export const REPORT_EXPORT_THEME = {
  reportStyle: {
    tableHeaderBold: true,
    tableHeaderAlign: "center",
    zebra: { even: "#ffffff", odd: "#F0F4F8" },
    totalRow: {
      background: "#9FD4AD",
      label: "Total"
    },
    tableHeaderBackground: "#9DB7C8"
  },

  reportLayout: {
    showLogo: true,
    logoPath: "/images/npa_full_transparent_bg.png",
    showFilterSummary: true,
    filterSummaryBelowTitle: true,
    filterSummaryExcludeFields: ["outputFormat"],
    showGeneratedAt: true
  },

  html: {
    titleFontSize: "calc(1.25rem - 1pt)",
    filterFontSize: "calc(0.95rem - 1pt)",
    tableFontSize: "calc(0.75rem - 1pt)",
    tableHeaderFontSize: "calc(0.7rem)",
    tableFooterFontSize: "calc(0.75rem)",
    logoMaxHeight: "58px",
    scrollMaxHeight: "min(78vh, 40rem)",
    mobileBreakpointPx: 1024
  },

  /** HTML on-screen font presets (toolbar A− / A / A+ → small / normal / large). Excel unchanged. */
  htmlFontPresets: {
    small: {
      titleFontSize: "calc(1.15rem - 1pt)",
      filterFontSize: "calc(0.85rem - 1pt)",
      tableFontSize: "calc(0.65rem - 1pt)",
      tableHeaderFontSize: "calc(0.6rem)",
      tableFooterFontSize: "calc(0.65rem)"
    },
    normal: {
      titleFontSize: "calc(1.25rem - 1pt)",
      filterFontSize: "calc(0.95rem - 1pt)",
      tableFontSize: "calc(0.75rem - 1pt)",
      tableHeaderFontSize: "calc(0.7rem)",
      tableFooterFontSize: "calc(0.75rem)"
    },
    large: {
      titleFontSize: "calc(1.35rem - 1pt)",
      filterFontSize: "calc(1.05rem - 1pt)",
      tableFontSize: "calc(0.85rem - 1pt)",
      tableHeaderFontSize: "calc(0.8rem)",
      tableFooterFontSize: "calc(0.85rem)"
    }
  },

  excel: {
    fontSize: 9,
    titleFontSize: 12,
    filterFontSize: 10,
    logoRowCount: 2,
    logoRowHeights: [34, 24],
    // Excel logo — fixed pixels (addReportExcelLogo.js, editAs: absolute). Height matches HTML max 58px.
    logoExtHeight: 58,
    logoExtWidth: 396,
    logoEndCol: 4.98, // legacy column anchor — no longer used for image placement
    showGridLines: false,
    companyNameColor: "FF0D9488",
    defaultZebra: { even: "#ffffff", odd: "#F0F4F8" },
    defaultTotalBackground: "#9FD4AD",
    defaultHeaderBackground: "#9DB7C8"
  }
};

/**
 * @param {"small" | "normal" | "large"} [preset]
 * @param {typeof REPORT_EXPORT_THEME} [theme]
 * @returns {Record<string, string>} CSS custom properties for `.report-output`
 */
export function getReportHtmlCssVars(preset = "normal", theme = REPORT_EXPORT_THEME) {
  const presets = theme.htmlFontPresets || {};
  const key = preset in presets ? preset : "normal";
  const h = presets[key] || theme.html;
  const layout = theme.html;
  return {
    "--report-title-font-size": h.titleFontSize,
    "--report-filter-font-size": h.filterFontSize,
    "--report-table-font-size": h.tableFontSize,
    "--report-table-header-font-size": h.tableHeaderFontSize,
    "--report-table-footer-font-size": h.tableFooterFontSize,
    "--report-logo-max-height": layout.logoMaxHeight,
    "--report-scroll-max-height": layout.scrollMaxHeight
  };
}

