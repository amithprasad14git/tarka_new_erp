"use client";

// Custom report table body — Unit Wise Cummulative (Month Wise banded or Unit Wise flat).

import CumulativeBandedReport from "./CumulativeBandedReport";
import UnitWiseSummaryReport from "./UnitWiseSummaryReport";
import { UNIT_WISE_CUMULATIVE_DATA_TYPE_UNIT_WISE } from "../../lib/reports/unitWiseCumulativeDataTypes";

/**
 * @param {{ custom?: object, financialYearCode?: string }} props
 */
export default function UnitWiseCumulativeReport({ custom = {}, financialYearCode = "" }) {
  const dataType = String(custom.dataType || "Month Wise");

  if (dataType === UNIT_WISE_CUMULATIVE_DATA_TYPE_UNIT_WISE) {
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
