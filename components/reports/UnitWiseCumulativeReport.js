"use client";

// Custom report table body — Unit Wise Cummulative (Month Wise banded or Summary flat).

import CumulativeBandedReport from "./CumulativeBandedReport";
import UnitWiseSummaryReport from "./UnitWiseSummaryReport";

/**
 * @param {{ custom?: object, financialYearCode?: string }} props
 */
export default function UnitWiseCumulativeReport({ custom = {}, financialYearCode = "" }) {
  const dataType = String(custom.dataType || "Month Wise");

  if (dataType === "Summary") {
    return <UnitWiseSummaryReport custom={custom} />;
  }

  return (
    <CumulativeBandedReport
      custom={custom}
      financialYearCode={financialYearCode}
      recoveredColumnLabel="Cash Recovered"
    />
  );
}
