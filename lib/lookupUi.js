// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

import { modules } from "../config/modules";
import { resolveLookupDisplayParts, resolveLookupLabelFieldName, getModuleGlobalSearchColumns } from "./lookupLabelField";

/**
 * Lookup field UI behaviour (shared by LookupSelect / LookupPicker). Module config lives in
 * config/modules.js per field under `lookup`.
 *
 * Resolves `lookup.ui` from module config.
 * - List-of-values (dropdown): `"lov"`, `"dropdown"`, `"select"`, `"list"`, or omit.
 * - Popup / modal picker: `"picker"`, `"popup"`, `"modal"`, `"dialog"`.
 */
export function normalizeLookupUi(ui) {
  const u = String(ui ?? "").trim().toLowerCase();
  // Treat common synonyms as either dropdown LoV or modal picker.
  if (!u || u === "dropdown" || u === "lov" || u === "select" || u === "list") {
    return "dropdown";
  }
  if (u === "picker" || u === "popup" || u === "modal" || u === "dialog") {
    return "picker";
  }
  return "dropdown";
}

/**
 * Columns for the lookup popup. Default: each column from parsed display spec, or one column from {@link resolveLookupLabelFieldName}.
 * @param {object} lookup — `pickerColumns` optional; see config/modules.js
 * @returns {{ field: string, header: string }[]}
 */
export function getPickerColumns(lookup) {
  const parts = resolveLookupDisplayParts(lookup);
  const fallback = resolveLookupLabelFieldName(lookup) || String(lookup?.valueField ?? "").trim() || "id";
  const { pickerColumns } = lookup;
  if (Array.isArray(pickerColumns) && pickerColumns.length > 0) {
    return pickerColumns.map((col) => {
      const field = String(col.field ?? "").trim();
      const header =
        col.header != null && String(col.header).trim() !== ""
          ? String(col.header).trim()
          : field || fallback;
      return { field: field || fallback, header };
    });
  }
  if (parts.length > 1) {
    return parts.map((p) => ({ field: p, header: p }));
  }
  return [{ field: fallback, header: fallback }];
}

function resolvePickerSearchColumnLabel(fieldName, refCfg, pickerColumns) {
  const col = (pickerColumns || []).find((c) => String(c.field) === String(fieldName));
  if (col?.header && String(col.header).trim()) return String(col.header).trim();
  const field = (refCfg?.fields || []).find((f) => f.name === fieldName);
  if (field?.label && String(field.label).trim()) return String(field.label).trim();
  return String(fieldName).trim();
}

/**
 * Placeholder for lookup popup search input — matches columns used by list `?search=` on the referenced module.
 * Optional override: `lookup.pickerSearchPlaceholder`.
 * @param {object} lookup
 * @returns {string}
 */
export function getLookupPickerSearchPlaceholder(lookup) {
  const explicit = String(lookup?.pickerSearchPlaceholder ?? "").trim();
  if (explicit) return explicit;

  const modKey = String(lookup?.module ?? "").trim();
  const refCfg = modKey ? modules[modKey] : null;
  if (!refCfg) return "Enter search text and Press Enter to Search";

  const searchCols = getModuleGlobalSearchColumns(refCfg);
  const pickerColumns = getPickerColumns(lookup);
  const labels = searchCols
    .map((col) => resolvePickerSearchColumnLabel(col, refCfg, pickerColumns))
    .filter(Boolean);

  if (labels.length === 0) return "Enter search text and Press Enter to Search";
  if (labels.length === 1) return `Enter the ${labels[0]} and Press Enter to Search`;
  if (labels.length === 2) return `Enter ${labels[0]} or ${labels[1]} and Press Enter to Search`;

  const last = labels[labels.length - 1];
  const rest = labels.slice(0, -1).join(", ");
  return `Enter ${rest} or ${last} and Press Enter to Search`;
}


