/**
 * Escapes characters that are special in MySQL `LIKE` patterns so user-typed text is matched literally
 * when used with `LIKE ... ESCAPE '\\'`.
 *
 * @param {unknown} raw
 */
export function escapeSqlLikePattern(raw) {
  return String(raw ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
