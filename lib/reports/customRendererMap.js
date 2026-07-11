// Shared report helper — registry of custom HTML renderer ids.

/**
 * Maps reportLayout.customRenderer (config/reports.js) to client components
 * registered in components/ReportCustomOutputView.js. Add an id here when
 * adding a new bespoke report layout. See README.md#reports-frozen-framework § Custom-layout reports.
 */

/** @type {Record<string, string>} */
export const CUSTOM_REPORT_RENDERER_IDS = {
  region_wise_cumulative: "region_wise_cumulative",
  unit_wise_cumulative: "unit_wise_cumulative",
  sarfaesi_case_report: "sarfaesi_case_report"
};

/**
 * @param {string | undefined} id
 * @returns {boolean}
 */
export function isKnownCustomRenderer(id) {
  return Boolean(id && Object.prototype.hasOwnProperty.call(CUSTOM_REPORT_RENDERER_IDS, id));
}

