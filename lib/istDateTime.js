/**
 * IST (Asia/Kolkata): audit timestamps, `getYmdISTFromInstant(new Date())` for “today” on date inputs,
 * calendar math, and normalizing values for `<input type="date">` (see `sqlDateFieldValue.js`).
 */

const IST_TIMEZONE = "Asia/Kolkata";

function partsByType(parts) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const p of parts) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/** MySQL DATETIME string in IST: `YYYY-MM-DD HH:mm:ss` (row audit, audit_logs, permissions matrix). */
export function formatInstantAsMysqlDatetimeIST(date = new Date()) {
  const parts = partsByType(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: IST_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date)
  );
  const { year: y, month: mo, day: d, hour: h, minute: min, second: s } = parts;
  if (!y || !mo || !d || h == null || min == null || s == null) return "";
  return `${y}-${mo}-${d} ${h}:${min}:${s}`;
}

/**
 * Calendar day YYYY-MM-DD in IST for an instant (fixes ISO strings whose UTC date ≠ IST calendar day).
 * Used by `toYyyyMmDdForSqlDateField`; call `getYmdISTFromInstant(new Date())` for today in IST.
 */
export function getYmdISTFromInstant(date) {
  const parts = partsByType(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: IST_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date)
  );
  const y = parts.year;
  const mo = parts.month;
  const d = parts.day;
  if (!y || !mo || !d) return "";
  return `${y}-${mo}-${d}`;
}

/** Subtract whole calendar days from a YYYY-MM-DD string (no DST in India). */
export function subtractCalendarDaysFromYmd(ymd, daysToSubtract) {
  const n = Math.max(0, Math.floor(Number(daysToSubtract) || 0));
  const m = String(ymd ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
