/**
 * Per-action row scopes on `user_permissions`: `view_scope`, `edit_scope`, `delete_scope`
 * values: `own` | `unit` | `all`. Create has no separate scope (single `can_create` flag).
 */

/** @param {unknown} s */
export function normalizeActionScope(s) {
  const v = String(s ?? "all").trim().toLowerCase();
  if (v === "own") return "own";
  if (v === "unit") return "unit";
  return "all";
}

function scopeOrAll(r, key) {
  const v = r?.[key];
  return v != null && String(v).trim() !== "" ? normalizeActionScope(v) : "all";
}

/**
 * @param {Record<string, unknown>|null|undefined} r
 * @returns {{ view_scope: string, edit_scope: string, delete_scope: string }}
 */
export function actionScopesFromDbRow(r) {
  if (!r) {
    return { view_scope: "all", edit_scope: "all", delete_scope: "all" };
  }
  return {
    view_scope: scopeOrAll(r, "view_scope"),
    edit_scope: scopeOrAll(r, "edit_scope"),
    delete_scope: scopeOrAll(r, "delete_scope")
  };
}
