// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Lets transaction screens load FK dropdowns / pickers (?lov=1) when the user has no explicit
 * permission on the reference module (e.g. lookup_value_master) but may create or edit a
 * parent module that references it (e.g. new_case_inward).
 */
import { modules } from "../config/modules";
import { hasModulePermission } from "./rbac";

function fieldListReferencesLookup(fields, lookupModuleKey) {
  if (!Array.isArray(fields)) return false;
  for (const f of fields) {
    if (f.type === "lookup" && f.lookup?.module === lookupModuleKey) return true;
  }
  return false;
}

export function moduleConfigReferencesLookup(moduleConfig, lookupModuleKey) {
  if (!moduleConfig) return false;
  if (fieldListReferencesLookup(moduleConfig.fields, lookupModuleKey)) return true;
  for (const ct of moduleConfig.childTables || []) {
    if (fieldListReferencesLookup(ct.fields, lookupModuleKey)) return true;
  }
  return false;
}

/**
 * True if a non-admin may call GET /api/crud/<lookupModule>?lov=1 based on parent-module access.
 */
export async function canAccessLovViaReferencingModule(user, lookupModuleKey) {
  if (!user) return false;
  if (Number(user.role) === 1) return true;

  for (const parentKey of Object.keys(modules)) {
    if (parentKey === lookupModuleKey) continue;
    const m = modules[parentKey];
    if (!moduleConfigReferencesLookup(m, lookupModuleKey)) continue;

    const [v, c, e] = await Promise.all([
      hasModulePermission(user, parentKey, "view"),
      hasModulePermission(user, parentKey, "create"),
      hasModulePermission(user, parentKey, "edit")
    ]);
    if (v || c || e) return true;
  }
  return false;
}
