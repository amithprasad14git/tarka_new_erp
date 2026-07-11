// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Prepares client payloads before INSERT/UPDATE: empty strings become SQL NULL where required
 * (optional dates, optional FK lookups). Called from CRUD routes after stripping audit fields.
 *
 * @param {Record<string, unknown>} body Incoming JSON / form payload
 * @param {{ fields?: Array<{ name: string, type: string }> }} moduleConfig
 * @returns {Record<string, unknown>}
 */
export function normalizeCrudPayload(body, moduleConfig) {
  const out = { ...body };
  // Walk each field definition and coerce client shapes to SQL-friendly values.
  for (const f of moduleConfig.fields || []) {
    if (f.type === "lookup" && f.lookup) {
      // Lookup IDs are sent as numbers; optional lookups must become SQL `NULL`.
      const key = f.name;
      if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
      const v = out[key];
      if (v === "" || v === undefined || v === null) {
        out[key] = null;
      } else {
        const n = Number(v);
        out[key] = Number.isFinite(n) && n > 0 ? n : null;
      }
      continue;
    }
    if (f.type !== "date") continue;
    // Dates are sent as `YYYY-MM-DD` strings; empty values must be SQL `NULL`.
    const key = f.name;
    if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
    const v = out[key];
    if (v === "" || v === undefined || v === null) {
      out[key] = null;
      continue;
    }
    if (typeof v === "string" && !String(v).trim()) {
      out[key] = null;
    }
  }
  return out;
}


