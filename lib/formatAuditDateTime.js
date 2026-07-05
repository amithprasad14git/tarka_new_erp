// Display format for row audit timestamps (createdDate / modifiedDate).

/**
 * @param {number} d day 1-31
 * @param {number} mo month 1-12
 * @param {number} y full year
 * @param {number} h24 hour 0-23
 * @param {number} mi minutes 0-59
 * @returns {string} e.g. "03-07-2026 5:30 PM"
 */
function formatParts(d, mo, y, h24, mi) {
  const ampm = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(d)}-${pad2(mo)}-${y} ${h12}:${pad2(mi)} ${ampm}`;
}

/**
 * Format audit datetime as dd-mm-yyyy h:mm AM/PM (matches grid list DATE_FORMAT).
 * @param {unknown} value MySQL datetime, ISO string, Date, or pre-formatted text
 * @returns {string}
 */
export function formatAuditDateTimeDisplay(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatParts(
      value.getDate(),
      value.getMonth() + 1,
      value.getFullYear(),
      value.getHours(),
      value.getMinutes()
    );
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const already = /^(\d{2})-(\d{2})-(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/i.exec(raw);
  if (already) {
    return `${already[1]}-${already[2]}-${already[3]} ${Number(already[4])}:${already[5]} ${already[6].toUpperCase()}`;
  }

  const mysql = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (mysql) {
    return formatParts(
      Number(mysql[3]),
      Number(mysql[2]),
      Number(mysql[1]),
      Number(mysql[4]),
      Number(mysql[5])
    );
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatParts(
      parsed.getDate(),
      parsed.getMonth() + 1,
      parsed.getFullYear(),
      parsed.getHours(),
      parsed.getMinutes()
    );
  }

  return raw;
}
