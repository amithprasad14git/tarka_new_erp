// Shared report helper — group flat SQL rows into banded sections for custom cumulative layouts.

/**
 * @param {Array<Record<string, unknown>>} rawRows
 * @param {{
 *   sectionIdKey: string,
 *   sectionLabelKey: string,
 *   detailLabelKey: string
 * }} keys
 * @returns {{ sections: object[], grandTotal: object }}
 */
export function groupCumulativeReportRows(rawRows, { sectionIdKey, sectionLabelKey, detailLabelKey }) {
  const sections = [];
  const bySection = new Map();
  const grandTotal = { caseCount: 0, cashRecovered: 0, npaReduced: 0 };

  for (const r of rawRows || []) {
    const sectionId = r[sectionIdKey];
    const sectionLabel = String(r[sectionLabelKey] ?? "");
    if (!bySection.has(sectionId)) {
      bySection.set(sectionId, {
        sectionId,
        sectionLabel,
        details: [],
        subtotal: { caseCount: 0, cashRecovered: 0, npaReduced: 0 }
      });
    }
    const section = bySection.get(sectionId);
    const caseCount = Number(r.no_of_cases) || 0;
    const cashRecovered = Number(r.amount_recovered) || 0;
    const npaReduced = Number(r.npa_reduced) || 0;

    section.details.push({
      detailLabel: String(r[detailLabelKey] ?? ""),
      caseCount,
      cashRecovered,
      npaReduced
    });
    section.subtotal.caseCount += caseCount;
    section.subtotal.cashRecovered += cashRecovered;
    section.subtotal.npaReduced += npaReduced;

    grandTotal.caseCount += caseCount;
    grandTotal.cashRecovered += cashRecovered;
    grandTotal.npaReduced += npaReduced;
  }

  for (const section of bySection.values()) {
    sections.push(section);
  }

  return { sections, grandTotal };
}

/**
 * @param {Array<{ caseCount?: number, cashRecovered?: number, npaReduced?: number }>} rows
 * @returns {{ caseCount: number, cashRecovered: number, npaReduced: number }}
 */
export function sumCumulativeMetrics(rows) {
  const totals = { caseCount: 0, cashRecovered: 0, npaReduced: 0 };
  for (const r of rows || []) {
    totals.caseCount += Number(r.caseCount) || 0;
    totals.cashRecovered += Number(r.cashRecovered) || 0;
    totals.npaReduced += Number(r.npaReduced) || 0;
  }
  return totals;
}

