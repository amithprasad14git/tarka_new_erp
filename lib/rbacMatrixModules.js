/**
 * Modules that appear as rows in the User Permissions matrix (config keys = `user_permissions.module`).
 */
import { modules } from "../config/modules";

/**
 * @returns {{ key: string, label: string, group: string }[]}
 */
export function getRbacMatrixModuleEntries() {
  return Object.entries(modules)
    .map(([key, m]) => ({
      key,
      label: String(m?.label || key),
      group: String(m?.group || "")
    }))
    .sort((a, b) => {
      const g = a.group.localeCompare(b.group);
      if (g !== 0) return g;
      return a.label.localeCompare(b.label);
    });
}

export function getRbacMatrixModuleKeySet() {
  return new Set(getRbacMatrixModuleEntries().map((e) => e.key));
}
