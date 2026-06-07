// Shared report helper — display format for HTML report generated timestamp.

/**
 * @param {string | null | undefined} mysqlDatetime `YYYY-MM-DD HH:mm:ss` (IST from server)
 * @returns {string}
 */
export function formatReportGeneratedAtDisplay(mysqlDatetime) {
  const raw = String(mysqlDatetime ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}, ${m[4]}:${m[5]}`;
}
