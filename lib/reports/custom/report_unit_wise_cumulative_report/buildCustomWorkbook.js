// Excel — Unit Wise Cummulative Report (Month Wise banded or Summary flat).

import { buildCumulativeBandedWorkbook } from "../buildCumulativeBandedWorkbook.js";
import { buildSummaryWorkbook } from "./buildSummaryWorkbook.js";

/**
 * @param {object} reportConfig
 * @param {{ custom: object, filterSummary?: string, reportLayout?: object }} payload
 */
export async function buildCustomWorkbook(reportConfig, payload) {
  const dataType = String(payload?.custom?.dataType || "Month Wise");
  if (dataType === "Summary") {
    return buildSummaryWorkbook(reportConfig, payload);
  }
  return buildCumulativeBandedWorkbook(reportConfig, payload, {
    recoveredColumnLabel: "Cash Recovered"
  });
}
