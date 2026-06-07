// Shared report helper — group flat ledger rows into sections with subtotals.

import { parseNumericCellValue } from "../formatInrNumber";

/**
 * @param {Array<Record<string, unknown>>} detailRows
 * @param {{ groupKey: string, sumKey?: string, headerPrefix?: string }} options
 */
export function groupStandardLedgerSections(detailRows, { groupKey, sumKey = "amount", headerPrefix = "" }) {
  const sections = [];
  const sectionMap = new Map();

  for (const row of detailRows || []) {
    const rawLabel = String(row[groupKey] ?? "").trim() || "(Blank)";
    let section = sectionMap.get(rawLabel);
    if (!section) {
      const headerLabel = headerPrefix ? `${headerPrefix}: ${rawLabel}` : rawLabel;
      section = { label: rawLabel, headerLabel, rows: [], subtotal: { [sumKey]: 0 } };
      sectionMap.set(rawLabel, section);
      sections.push(section);
    }
    section.rows.push(row);
    const n = parseNumericCellValue(row[sumKey]);
    if (n != null) section.subtotal[sumKey] += n;
  }

  let grandSum = 0;
  for (const section of sections) {
    section.rows = section.rows.map((r, idx) => ({ ...r, slNo: idx + 1 }));
    grandSum += section.subtotal[sumKey] || 0;
  }

  return {
    sections,
    grandTotal: { [sumKey]: grandSum }
  };
}
