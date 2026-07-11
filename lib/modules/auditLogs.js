/**
 * =============================================================================
 * AUDIT LOGS (MODULE UI HELPERS) — Grid columns and JSON previews
 * =============================================================================
 * The audit_logs screen is read-only: custom column layout, truncated JSON
 * previews, and a Compare modal. These helpers decide which columns get special
 * treatment and how snapshot JSON is shown in the grid vs full display.
 * Re-exports display label helpers from lib/auditDisplay.js.
 * =============================================================================
 */

export {
  buildAuditRecordLabel,
  formatAuditLookupCompareValue,
  formatAuditModuleLabel,
  getAuditFieldLabelKey,
  resolveAuditFieldLabel
} from "../auditDisplay";

/** True when the current screen is Audit Logs (custom layout, no CRUD edit). */
export function isAuditLogsModule(moduleKey) {
  // Audit log screen uses custom column layout and Compare modal instead of CRUD edit.
  return moduleKey === "audit_logs";
}

/** Hide raw record_id in the grid (operators use record_label instead). */
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
      // Grid shows field names only; full JSON is in the Compare modal.
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
 * Full audit JSON for reports (no truncation). Pretty-prints JSON objects.
 * @param {unknown} raw
 */
export function auditJsonFullDisplay(raw) {
  if (raw == null) return "";
  if (typeof raw === "object") {
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return "";
    }
  }
  const text = String(raw).trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/**
 * True when the field is the audit created_at timestamp (special formatting).
 * @param {string} fieldName
 * @param {string} [_moduleKey] ignored
 */
export function isAuditLogsCreatedAtField(fieldName, _moduleKey) {
  return String(fieldName ?? "").trim() === "created_at";
}

/** True when the column is the module key (uses formatAuditModuleLabel). */
export function isAuditLogsModuleColumn(fieldName) {
  return fieldName === "module";
}

/** True when the column is the human record label. */
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


