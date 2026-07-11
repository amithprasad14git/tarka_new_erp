// Shared report helper — row count for custom-layout HTML meta.

/**
 * @param {object | null | undefined} custom
 * @returns {number}
 */
export function countCustomReportRows(custom) {
  if (!custom || typeof custom !== "object") return 0;
  if (Array.isArray(custom.cases)) return custom.cases.length;
  if (Array.isArray(custom.rows)) return custom.rows.length;
  if (Array.isArray(custom.sections)) {
    return custom.sections.reduce((n, section) => n + (section.details?.length || 0), 0);
  }
  return 0;
}

