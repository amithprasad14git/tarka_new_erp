// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

export {
  buildAuditRecordLabel,
  formatAuditLookupCompareValue,
  formatAuditModuleLabel,
  getAuditFieldLabelKey,
  resolveAuditFieldLabel
} from "../auditDisplay";

export function isAuditLogsModule(moduleKey) {
  return moduleKey === "audit_logs";
}

export function shouldHideAuditLogsRecordId(fieldName) {
  return fieldName === "record_id";
}

/**
 * @param {string} fieldName
 * @param {string} [_moduleKey] ignored; kept for call-site clarity
 */
export function isAuditLogsJsonField(fieldName, _moduleKey) {
  const name = String(fieldName ?? "").trim();
  return name === "old_data" || name === "new_data";
}

/** Max characters shown for old_data / new_data in the audit grid (full data via Compare). */
export const AUDIT_JSON_PREVIEW_MAX_CHARS = 32;

const PLACEHOLDER_RECORD_LABEL_RE = /^Record #\d+$/i;

/** True when label is missing or only the generic `Record #<id>` fallback. */
export function isPlaceholderAuditRecordLabel(label) {
  const text = String(label ?? "").trim();
  return !text || PLACEHOLDER_RECORD_LABEL_RE.test(text);
}

function auditJsonRawText(raw) {
  if (raw == null) return "";
  if (typeof raw === "object") {
    try {
      return JSON.stringify(raw);
    } catch {
      return "";
    }
  }
  return String(raw).trim();
}

/**
 * Short grid preview for audit JSON columns; Compare modal shows full snapshots.
 * @param {unknown} raw
 * @param {number} [maxChars]
 */
export function auditJsonPreview(raw, maxChars = AUDIT_JSON_PREVIEW_MAX_CHARS) {
  const limit = Math.max(8, Number(maxChars) || AUDIT_JSON_PREVIEW_MAX_CHARS);
  const text = auditJsonRawText(raw);
  if (!text) return "";

  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const keys = Object.keys(obj);
      if (keys.length) {
        const summary = keys.join(", ");
        return summary.length > limit ? `${summary.slice(0, limit)}…` : summary;
      }
    }
  } catch {
    /* not JSON — compact single-line text below */
  }

  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}…` : compact;
}

/**
 * @param {string} fieldName
 * @param {string} [_moduleKey] ignored
 */
export function isAuditLogsCreatedAtField(fieldName, _moduleKey) {
  return String(fieldName ?? "").trim() === "created_at";
}

export function isAuditLogsModuleColumn(fieldName) {
  return fieldName === "module";
}

export function isAuditLogsRecordLabelColumn(fieldName) {
  return fieldName === "record_label";
}

/** Fixed-layout column class for the audit_logs grid (see globals.css). */
export function getAuditLogsGridColumnClass(fieldName) {
  switch (String(fieldName ?? "").trim()) {
    case "user_id":
      return "audit-col-user";
    case "module":
      return "audit-col-module";
    case "action":
      return "audit-col-action";
    case "record_label":
      return "audit-col-record";
    case "created_at":
      return "audit-col-created";
    case "old_data":
    case "new_data":
      return "audit-col-json";
    default:
      return "";
  }
}
