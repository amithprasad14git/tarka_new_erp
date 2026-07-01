// Shared report helper — group flat ledger rows into sections with subtotals.

import { parseNumericCellValue } from "../formatInrNumber";

/**
 * @param {Array<Record<string, unknown>>} detailRows
 * @param {{ groupKey: string, sumKey?: string, sumKeys?: string[], headerPrefix?: string }} options
 */
export function groupStandardLedgerSections(
  detailRows,
  { groupKey, sumKey = "amount", sumKeys, headerPrefix = "" }
) {
  const keys = sumKeys && sumKeys.length > 0 ? sumKeys : [sumKey];
  const emptyTotals = () => Object.fromEntries(keys.map((k) => [k, 0]));

  const sections = [];
  const sectionMap = new Map();

  for (const row of detailRows || []) {
    const rawLabel = String(row[groupKey] ?? "").trim() || "(Blank)";
    let section = sectionMap.get(rawLabel);
    if (!section) {
      const headerLabel = headerPrefix ? `${headerPrefix}: ${rawLabel}` : rawLabel;
      section = { label: rawLabel, headerLabel, rows: [], subtotal: emptyTotals() };
      sectionMap.set(rawLabel, section);
      sections.push(section);
    }
    section.rows.push(row);
    for (const k of keys) {
      const n = parseNumericCellValue(row[k]);
      if (n != null) section.subtotal[k] += n;
    }
  }

  const grandTotal = emptyTotals();
  for (const section of sections) {
    section.rows = section.rows.map((r, idx) => ({ ...r, slNo: idx + 1 }));
    for (const k of keys) {
      grandTotal[k] += section.subtotal[k] || 0;
    }
  }

  return {
    sections,
    grandTotal
  };
}
