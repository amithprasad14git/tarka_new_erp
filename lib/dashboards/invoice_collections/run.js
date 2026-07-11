// Dashboard — Invoice Collections landing widget server loader.

/**
 * Entry point for GET /api/dashboard/invoice_collections.
 * Aggregates FY billed/received across recovery, SARFAESI, and vehicle invoices.
 * UI: components/dashboards/invoice_collections/InvoiceCollectionsWidget.js
 */

import { loadActiveFinancialYear } from "../loadActiveFinancialYear.js";
import { aggregateInvoiceCollections } from "./aggregateInvoiceCollections.js";
import { resolveUnitScope } from "./resolveUnitScope.js";

/**
 * Server loader for GET /api/dashboard/invoice_collections.
 * Steps: auth → active FY → unit scope → aggregateInvoiceCollections.
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
  // No unit assigned — return zeros with message instead of HTTP error.
  if (!unitIds.length) {
    return {
      ok: true,
      data: {
        financialYear: { yearCode: fy.yearCode, yearRangeLabel: fy.yearRangeLabel },
        totals: { billed: 0, received: 0, outstanding: 0, tds: 0, collectedPct: 0 },
        pending: { count: 0, amount: 0 },
        byType: [],
        byBank: [],
        monthWiseReceived: [],
        counts: { billed: 0, received: 0 },
        message: message || "No unit scope."
      }
    };
  }

  const data = await aggregateInvoiceCollections(unitIds, fy);
  return { ok: true, data };
}

