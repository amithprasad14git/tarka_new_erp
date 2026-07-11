// Shared report helper — group SQL rows for Region Wise Cummulative custom layout.

import { groupCumulativeReportRows } from "./groupCumulativeReportRows.js";

/**
 * Turns flat SQL rows (one per RBO × loan category) into region sections with subtotals.
 * Used by report_region_wise_cumulative_report.js before HTML/Excel render.
 *
 * @param {Array<Record<string, unknown>>} rawRows
 * @returns {{ sections: object[], grandTotal: object }}
 */
export function groupRegionWiseCumulativeRows(rawRows) {
  const { sections, grandTotal } = groupCumulativeReportRows(rawRows, {
    sectionIdKey: "rbo_ro_id",
    sectionLabelKey: "rbo_ro",
    detailLabelKey: "loan_category"
  });

  return {
    sections: sections.map((s) => ({
      regionId: s.sectionId,
      regionLabel: s.sectionLabel,
      details: s.details.map((d) => ({
        loanCategoryLabel: d.detailLabel,
        caseCount: d.caseCount,
        cashRecovered: d.cashRecovered,
        npaReduced: d.npaReduced
      })),
      subtotal: s.subtotal
    })),
    grandTotal
  };
}

