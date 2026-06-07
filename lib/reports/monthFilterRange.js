// Shared report helper — month picker (YYYY-MM) to SQL date bounds.

import { getYmdISTFromInstant } from "../istDateTime";

/**
 * @param {string} value YYYY-MM
 * @returns {boolean}
 */
export function isValidMonthString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const [y, m] = value.split("-").map((x) => parseInt(x, 10));
  return Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12;
}

/** @returns {string} YYYY-MM for current IST month */
export function currentMonthYyyyMm(date = new Date()) {
  const ymd = getYmdISTFromInstant(date);
  const m = ymd.match(/^(\d{4})-(\d{2})/);
  if (!m) return ymd.slice(0, 7);
  return `${m[1]}-${m[2]}`;
}

/**
 * @param {string} monthYyyyMm YYYY-MM
 * @returns {string} YYYY-MM-DD first day of month
 */
export function monthStartYmd(monthYyyyMm) {
  if (!isValidMonthString(monthYyyyMm)) return "";
  return `${monthYyyyMm}-01`;
}

/**
 * @param {string} monthYyyyMm YYYY-MM
 * @returns {string} YYYY-MM-DD last day of month
 */
export function monthEndYmd(monthYyyyMm) {
  if (!isValidMonthString(monthYyyyMm)) return "";
  const [y, mo] = monthYyyyMm.split("-").map((x) => parseInt(x, 10));
  const last = new Date(Date.UTC(y, mo, 0));
  const d = String(last.getUTCDate()).padStart(2, "0");
  return `${monthYyyyMm}-${d}`;
}

/**
 * @param {string} fromMonth YYYY-MM
 * @param {string} toMonth YYYY-MM
 * @returns {string | null} error message or null
 */
export function validateMonthRange(fromMonth, toMonth) {
  const from = String(fromMonth || "").trim();
  const to = String(toMonth || "").trim();
  if (!isValidMonthString(from)) return "From Month must be a month in YYYY-MM format.";
  if (!isValidMonthString(to)) return "To Month must be a month in YYYY-MM format.";
  if (from > to) return "From Month cannot be after To Month.";
  return null;
}
