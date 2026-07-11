// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Builds query params for `/api/crud/lookup_value_master?lov=1` when a field should only list
 * values for one lookup type. Server applies `filterLookupTypeName` / `filterLookupType` only
 * for that module in LoV mode (see app/api/crud/[module]/route.js).
 *
 * @param {URLSearchParams} searchParams
 * @param {{ module?: string, filterLookupTypeName?: string, filterLookupType?: string|number }} lookup
 */
export function appendLookupValueMasterLovParams(searchParams, lookup) {
  if (!lookup || String(lookup.module || "").trim() !== "lookup_value_master") return;
  const name = String(lookup.filterLookupTypeName ?? "").trim();
  if (name) {
    // Filter LoV rows to one lookup type by human-readable name.
    searchParams.set("filterLookupTypeName", name);
    return;
  }
  const raw = lookup.filterLookupType;
  if (raw != null && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) searchParams.set("filterLookupType", String(n));
  }
}


