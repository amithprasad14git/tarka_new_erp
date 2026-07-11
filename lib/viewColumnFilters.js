// Shared helpers for master view-grid column filters (draft input vs committed API filters).

/** Idle delay before debounced text column filters hit the list API. */
export const COLUMN_FILTER_DEBOUNCE_MS = 1200;

/**
 * Remove keys whose trimmed value is empty.
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, string>}
 */
export function stripEmptyFilters(obj) {
  const next = { ...(obj || {}) };
  for (const key of Object.keys(next)) {
    if (String(next[key] ?? "").trim() === "") {
      delete next[key];
    }
  }
  return next;
}

/**
 * Build committed filter object from draft column inputs.
 * @param {Record<string, unknown>} input
 * @returns {Record<string, string>}
 */
export function normalizeCommittedFromInput(input) {
  const next = stripEmptyFilters(input);
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(next)) {
    out[key] = String(value).trim();
  }
  return out;
}

/**
 * @param {Record<string, unknown> | null | undefined} a
 * @param {Record<string, unknown> | null | undefined} b
 * @returns {boolean}
 */
export function columnFiltersEqual(a, b) {
  const na = normalizeCommittedFromInput(a);
  const nb = normalizeCommittedFromInput(b);
  const keysA = Object.keys(na).sort();
  const keysB = Object.keys(nb).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (na[keysA[i]] !== nb[keysB[i]]) return false;
  }
  return true;
}

/**
 * True when draft inputs differ from committed filters (trimmed).
 * @param {Record<string, unknown>} input
 * @param {Record<string, unknown>} committed
 * @returns {boolean}
 */
export function hasUncommittedColumnFilters(input, committed) {
  return !columnFiltersEqual(input, committed);
}

/**
 * True when draft or committed filters contain any non-empty value.
 * @param {Record<string, unknown>} input
 * @param {Record<string, unknown>} committed
 * @returns {boolean}
 */
export function hasAnyColumnFilterValue(input, committed) {
  const hasValue = (obj) =>
    Object.values(obj || {}).some((v) => String(v ?? "").trim() !== "");
  return hasValue(input) || hasValue(committed);
}

