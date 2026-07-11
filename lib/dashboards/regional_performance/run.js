// Dashboard — Regional Performance landing widget server loader.

/**
 * Entry point for GET /api/dashboard/regional_performance.
 * Resolves active FY and unit scope, then runs SQL aggregation.
 * UI: components/dashboards/regional_performance/RegionalPerformanceWidget.js
 */

import { loadActiveFinancialYear } from "../loadActiveFinancialYear.js";
import { aggregateRegionalPerformance } from "./aggregateRegionalPerformance.js";
import { resolveUnitScope } from "../invoice_collections/resolveUnitScope.js";

/**
 * Server loader for GET /api/dashboard/regional_performance.
 * Steps: auth → active FY → unit scope → SQL aggregation.
 * @param {object} user
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, status?: number }>}
 */
export async function loadDashboard(user) {
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const fy = await loadActiveFinancialYear();
  if (!fy) {
    return { ok: false, status: 400, error: "No active financial year." };
  }

  const { unitIds, message } = await resolveUnitScope(user);
  // No unit — return empty charts with explanation (not an error).
  if (!unitIds.length) {
    return {
      ok: true,
      data: {
        financialYear: { yearCode: fy.yearCode, yearRangeLabel: fy.yearRangeLabel },
        totals: { caseCount: 0, amountRecovered: 0, npaReduced: 0 },
        byLoanType: [],
        byRegion: [],
        monthWiseSettled: [],
        message: message || "No unit scope."
      }
    };
  }

  const data = await aggregateRegionalPerformance(unitIds, fy);
  return { ok: true, data };
}

