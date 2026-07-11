// Shared report helper — default filter values (month start/end in IST).

/**
 * Initial filter values when opening a report tab (monthStart, monthEnd, today defaults in IST).
 */

import { getYmdISTFromInstant } from "../istDateTime";
import { currentMonthYyyyMm } from "./monthFilterRange";

/** @returns {string} YYYY-MM-DD */
function monthStartYmd(date = new Date()) {
  const ymd = getYmdISTFromInstant(date);
  const m = ymd.match(/^(\d{4})-(\d{2})/);
  if (!m) return ymd;
  return `${m[1]}-${m[2]}-01`;
}

/** @returns {string} YYYY-MM-DD */
function monthEndYmd(date = new Date()) {
  const ymd = getYmdISTFromInstant(date);
  const m = ymd.match(/^(\d{4})-(\d{2})/);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const last = new Date(Date.UTC(y, mo, 0));
  const d = String(last.getUTCDate()).padStart(2, "0");
  return `${m[1]}-${m[2]}-${d}`;
}

/**
 * @param {{ fields?: Array<{ name: string, default?: string }> }} reportConfig
 * @returns {Record<string, string>}
 */
export function getReportFilterInitialValues(reportConfig) {
  const out = {};
  for (const f of reportConfig?.fields || []) {
    if (f.default === "monthStart") out[f.name] = monthStartYmd();
    else if (f.default === "monthEnd") out[f.name] = monthEndYmd();
    else if (f.default === "currentMonth") out[f.name] = currentMonthYyyyMm();
    else if (f.default === "today") out[f.name] = getYmdISTFromInstant(new Date());
    else if (f.default != null && f.default !== "") out[f.name] = String(f.default);
    else if (f.type === "lookup") out[f.name] = "";
    else if (f.type === "select" && f.options?.length) {
      if (f.default != null && f.default !== "") out[f.name] = String(f.default);
      else out[f.name] = "";
    } else out[f.name] = "";
  }
  return out;
}

