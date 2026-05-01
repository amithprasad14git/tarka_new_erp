// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Lookup display labels: referenced module `lookupDisplayField` may list several real
 * columns separated by " - " (e.g. `branchCode - branchName`). No extra DB column —
 * the app builds a display string with CONCAT_WS / client join. Optional
 * `lookupSearchFields` on the referenced module drives OR search / FK filters.
 *
 * Safe for client bundles — no mysql2 here (see lookupLabelFieldSql.js for SQL helpers).
 */
import { modules } from "../config/modules";
import { rowValueForField } from "./gridRowValue";

/**
 * Split a module config string into column names using " - " as delimiter.
 * Only segments that exist on the module are kept (allowlist).
 */
export function parseLookupDisplayFieldSpec(spec, fieldNameSet) {
  if (!spec || typeof spec !== "string") return [];
  const parts = spec
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.filter((p) => fieldNameSet.has(p));
}

function fieldNameSetForModule(refCfg) {
  return new Set((refCfg?.fields || []).map((f) => f.name));
}

/**
 * Ordered real column names used to show a lookup row label (LoV, picker, enrich).
 * - Uses `lookup.labelField` if set (may be multi-column: `a - b`).
 * - Else parses referenced module `lookupDisplayField` the same way.
 */
export function resolveLookupDisplayParts(lookup) {
  if (!lookup || typeof lookup !== "object") return [];
  const modKey = String(lookup.module ?? "").trim();
  const ref = modKey ? modules[modKey] : null;
  const names = fieldNameSetForModule(ref);

  const explicit = String(lookup.labelField ?? "").trim();
  if (explicit) {
    const parsed = parseLookupDisplayFieldSpec(explicit, names);
    if (parsed.length) return parsed;
    if (names.has(explicit)) return [explicit];
    return [];
  }
  if (!ref) return [];
  const raw = String(ref.lookupDisplayField ?? "").trim();
  const parsed = parseLookupDisplayFieldSpec(raw, names);
  if (parsed.length) return parsed;
  if (raw && names.has(raw)) return [raw];
  return [];
}

/**
 * First display column (sort default, single-column fallbacks).
 */
export function resolveLookupLabelFieldName(lookup) {
  const parts = resolveLookupDisplayParts(lookup);
  return parts[0] ? parts[0] : "";
}

/**
 * Human-readable label from a lookup row (API row object).
 */
export function formatLookupRowLabel(row, lookup) {
  const parts = resolveLookupDisplayParts(lookup);
  if (!parts.length) return "";
  const vals = parts
    .map((p) => rowValueForField(row, p))
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v).trim());
  return vals.join(" - ");
}

/**
 * Columns to OR-match for `?search=` / popup search / FK text filter on a referenced module.
 * - Field-level `lookup.searchField`: if set, one column or `a - b` parsed.
 * - Else module `lookupSearchFields` (allowlisted).
 * - Else columns parsed from module `lookupDisplayField`.
 */
export function getRefLookupSearchColumns(refCfg, lookup) {
  if (!refCfg) return [];
  const names = fieldNameSetForModule(refCfg);
  const override = String(lookup?.searchField ?? "").trim();
  if (override) {
    const parsed = parseLookupDisplayFieldSpec(override, names);
    if (parsed.length) return parsed;
    if (names.has(override)) return [override];
    return [];
  }
  const multi = refCfg.lookupSearchFields;
  if (Array.isArray(multi) && multi.length > 0) {
    return multi.map((c) => String(c ?? "").trim()).filter((c) => c && names.has(c));
  }
  return parseLookupDisplayFieldSpec(String(refCfg.lookupDisplayField ?? "").trim(), names);
}

/**
 * Global list `?search=` columns for the module being listed.
 */
export function getModuleGlobalSearchColumns(moduleConfig) {
  const names = fieldNameSetForModule(moduleConfig);
  const multi = moduleConfig.lookupSearchFields;
  if (Array.isArray(multi) && multi.length > 0) {
    return multi.map((c) => String(c ?? "").trim()).filter((c) => c && names.has(c));
  }
  return parseLookupDisplayFieldSpec(String(moduleConfig.lookupDisplayField ?? "").trim(), names);
}

/**
 * JSON key for the enriched label on list rows: `displayKey` if set, else `{fieldName}Label`.
 * @param {{ type?: string, name?: string, displayKey?: string }} field
 */
export function getLookupRowLabelKey(field) {
  if (!field || field.type !== "lookup") return "";
  const explicit = String(field.displayKey ?? "").trim();
  if (explicit) return explicit;
  return `${String(field.name)}Label`;
}
