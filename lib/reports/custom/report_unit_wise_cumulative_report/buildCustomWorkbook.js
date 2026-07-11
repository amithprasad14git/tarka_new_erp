// Excel — Unit Wise Cummulative Report (Month Wise banded or Unit Wise flat).

import { buildCumulativeBandedWorkbook } from "../buildCumulativeBandedWorkbook.js";
import { buildSummaryWorkbook } from "./buildSummaryWorkbook.js";
import { UNIT_WISE_CUMULATIVE_DATA_TYPE_UNIT_WISE } from "../../unitWiseCumulativeDataTypes.js";

/**
 * @param {object} reportConfig
 * @param {{ custom: object, filterSummary?: string, reportLayout?: object }} payload
 */
export async function buildCustomWorkbook(reportConfig, payload) {
  const dataType = String(payload?.custom?.dataType || "Month Wise");
  if (dataType === UNIT_WISE_CUMULATIVE_DATA_TYPE_UNIT_WISE) {
    return buildSummaryWorkbook(reportConfig, payload);
  }
  return buildCumulativeBandedWorkbook(reportConfig, payload, {
    recoveredColumnLabel: "Cash Recovered"
  });
}

