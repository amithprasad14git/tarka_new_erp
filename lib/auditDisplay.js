/**
 * =============================================================================
 * AUDIT DISPLAY — Human-readable labels for audit log screens
 * =============================================================================
 * Audit rows store module keys, field names, and raw snapshot values (often IDs).
 * This module turns those into labels operators can read: module titles, field
 * captions, record display names, and lookup text for before/after compare.
 * =============================================================================
 */
import { modules } from "../config/modules";
import { rowValueForField } from "./gridRowValue";
import { getLookupRowLabelKey, parseLookupDisplayFieldSpec } from "./lookupLabelField";

/**
 * Allowlist of real column names on a module (used when parsing display specs).
 * @param {object | null | undefined} moduleConfig
 * @returns {Set<string>}
 */
function fieldNameSetForModule(moduleConfig) {
  return new Set((moduleConfig?.fields || []).map((f) => f.name));
}

/**
 * Build a short human-readable label for an audited business record.
 * Uses module `lookupDisplayField`; falls back to `Record #<id>` so audit lists
 * still show something useful when the row or display config is missing.
 * @param {string} moduleKey
 * @param {object | null | undefined} row
 * @param {number | string | null | undefined} [recordId]
 * @returns {string}
 */
export function buildAuditRecordLabel(moduleKey, row, recordId = null) {
  const mod = modules[moduleKey];
  const id = recordId != null && String(recordId).trim() !== "" ? String(recordId).trim() : null;
  if (!mod) return id ? `Record #${id}` : "";

  const names = fieldNameSetForModule(mod);
  const raw = String(mod.lookupDisplayField ?? "").trim();
  let parts = parseLookupDisplayFieldSpec(raw, names);
  if (!parts.length && raw && names.has(raw)) parts = [raw];

  // Prefer a human label built from configured display columns on the row.
  if (row && typeof row === "object" && parts.length) {
    const vals = parts
      .map((p) => rowValueForField(row, p))
      .filter((v) => v != null && String(v).trim() !== "")
      .map((v) => String(v).trim());
    if (vals.length) return vals.join(" - ");
  }

  return id ? `Record #${id}` : "";
}

/**
 * Module title for audit UI (config label, else the raw module key).
 * @param {string} moduleKey
 * @returns {string}
 */
export function formatAuditModuleLabel(moduleKey) {
  const key = String(moduleKey ?? "").trim();
  if (!key) return "";
  return modules[key]?.label || key;
}

/**
 * Field caption for audit compare / detail (config label, else the field name).
 * @param {string} moduleKey
 * @param {string} fieldKey
 * @returns {string}
 */
export function resolveAuditFieldLabel(moduleKey, fieldKey) {
  const key = String(fieldKey ?? "").trim();
  if (!key) return "";
  const mod = modules[moduleKey];
  const field = (mod?.fields || []).find((f) => f.name === key);
  return field?.label || key;
}

/**
 * Lookup enriched label key for a field on a module, if configured.
 * Used when audit snapshots need the companion `*Label` column name.
 * @param {string} moduleKey
 * @param {string} fieldKey
 * @returns {string}
 */
export function getAuditFieldLabelKey(moduleKey, fieldKey) {
  const mod = modules[moduleKey];
  const field = (mod?.fields || []).find((f) => f.name === fieldKey);
  if (!field || field.type !== "lookup") return "";
  return getLookupRowLabelKey(field);
}

/**
 * Human-readable value for a lookup field in audit compare (snapshot JSON has ids only).
 * Prefers `*Label` on the enriched snapshot row; falls back to current record when ids match
 * so operators see names instead of opaque foreign keys.
 * @param {string} moduleKey
 * @param {string} fieldName
 * @param {object | null | undefined} snapshotRow
 * @param {object | null | undefined} contextRow
 * @returns {string | null} display text, or null to fall back to raw snapshot value
 */
export function formatAuditLookupCompareValue(moduleKey, fieldName, snapshotRow, contextRow) {
  const mod = modules[moduleKey];
  if (!mod) return null;
  const field = (mod.fields || []).find((f) => f.name === fieldName);
  if (!field || field.type !== "lookup") return null;

  const labelKey = getLookupRowLabelKey(field);
  if (!labelKey) return null;

  if (snapshotRow && typeof snapshotRow === "object") {
    const fromSnap = rowValueForField(snapshotRow, labelKey);
    if (fromSnap != null && String(fromSnap).trim() !== "") return String(fromSnap).trim();
  }

  if (contextRow && snapshotRow && typeof snapshotRow === "object") {
    const snapId = rowValueForField(snapshotRow, fieldName);
    const ctxId = rowValueForField(contextRow, fieldName);
    if (
      snapId != null &&
      ctxId != null &&
      String(snapId).trim() !== "" &&
      String(snapId) === String(ctxId)
    ) {
      const fromCtx = rowValueForField(contextRow, labelKey);
      if (fromCtx != null && String(fromCtx).trim() !== "") return String(fromCtx).trim();
    }
  }

  return null;
}
