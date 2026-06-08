// Shared helper — format dashboard "Updated" timestamp in IST.

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * @param {Date | number | null | undefined} date
 * @returns {string} e.g. "Updated 10:42 AM" or empty when invalid
 */
export function formatDashboardUpdatedAt(date) {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(d);

  const normalized = time.replace(/\s(am|pm)$/i, (_, p) => ` ${p.toUpperCase()}`);
  return `Updated ${normalized}`;
}
