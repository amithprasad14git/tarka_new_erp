import { resolveLookupLabelFieldName } from "./lookupLabelField";

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
  if (!u || u === "dropdown" || u === "lov" || u === "select" || u === "list") {
    return "dropdown";
  }
  if (u === "picker" || u === "popup" || u === "modal" || u === "dialog") {
    return "picker";
  }
  return "dropdown";
}

/**
 * Columns for the lookup popup. Default is one column from {@link resolveLookupLabelFieldName} (else `valueField` / `id`).
 * @param {object} lookup — `pickerColumns` optional; see config/modules.js
 * @returns {{ field: string, header: string }[]}
 */
export function getPickerColumns(lookup) {
  const resolved = resolveLookupLabelFieldName(lookup);
  const labelField = resolved || String(lookup?.valueField ?? "").trim() || "id";
  const { pickerColumns } = lookup;
  if (Array.isArray(pickerColumns) && pickerColumns.length > 0) {
    return pickerColumns.map((col) => {
      const field = String(col.field ?? "").trim();
      const header =
        col.header != null && String(col.header).trim() !== ""
          ? String(col.header).trim()
          : field || labelField;
      return { field: field || labelField, header };
    });
  }
  return [{ field: labelField, header: labelField }];
}
