"use client";

// Custom report table body — Region Wise Cummulative Report.

/**
 * Banded table: RBO region rowspans, loan category rows, blue subtotals, yellow grand total.
 * Data from report_region_wise_cumulative_report.js via ReportCustomOutputView custom prop.
 */

import CumulativeBandedReport from "./CumulativeBandedReport";

/**
 * @param {{ custom?: object, financialYearCode?: string }} props
 */
export default function RegionWiseCumulativeReport({ custom = {}, financialYearCode = "" }) {
  return (
    <CumulativeBandedReport
      custom={custom}
      financialYearCode={financialYearCode}
      recoveredColumnLabel="Cash Recovered"
    />
  );
}

