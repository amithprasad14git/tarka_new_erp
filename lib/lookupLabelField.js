/**
 * Resolves which DB column holds the human-readable value for a lookup:
 * `lookup.labelField`, else the referenced module’s `lookupDisplayField`.
 */
import { modules } from "../config/modules";

export function resolveLookupLabelFieldName(lookup) {
  if (!lookup || typeof lookup !== "object") return "";
  const explicit = String(lookup.labelField ?? "").trim();
  if (explicit) return explicit;
  const modKey = String(lookup.module ?? "").trim();
  const ref = modKey ? modules[modKey] : null;
  return String(ref?.lookupDisplayField ?? "").trim();
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
