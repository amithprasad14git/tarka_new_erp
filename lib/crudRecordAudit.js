/**
 * =============================================================================
 * ROW AUDIT COLUMNS — Automatic “who/when” stamps on each business row
 * =============================================================================
 * Many tables track four columns: who created the row, when, who last changed it, when.
 * They appear in config/modules.js like normal fields but with excludeFromForm so users
 * never type them — the server fills them on insert/update (this file + crud.service).
 *
 * Clients must not spoof these: stripClientAuditFields removes them from incoming JSON
 * so a crafted request cannot fake another user’s name on createdBy.
 *
 * If a module’s field list contains all four names, moduleHasRowAuditFields is true and
 * create/update services apply the stamps automatically.
 * =============================================================================
 */

// Default column names in the database (camelCase as used by this app).
export const DEFAULT_AUDIT_COLUMNS = {
  createdBy: "createdBy",
  createdAt: "createdDate",
  modifiedBy: "modifiedBy",
  modifiedAt: "modifiedDate"
};

// Keys removed from client payloads (and old snake_case aliases) so they cannot be forged.
const STRIP_KEYS = new Set([
  "createdBy",
  "createdDate",
  "modifiedBy",
  "modifiedDate",
  "created_by",
  "created_at",
  "modified_by",
  "modified_at"
]);

/**
 * Returns the audit column names for a module, allowing optional overrides via moduleConfig.auditColumns.
 */
export function getAuditColumnNames(moduleConfig) {
  return { ...DEFAULT_AUDIT_COLUMNS, ...(moduleConfig?.auditColumns || {}) };
}

/**
 * True when this module lists all four audit field names — then POST/PUT will auto-fill them.
 */
export function moduleHasRowAuditFields(moduleConfig) {
  const names = new Set((moduleConfig?.fields || []).map((f) => f.name));
  const c = getAuditColumnNames(moduleConfig);
  return (
    names.has(c.createdBy) &&
    names.has(c.createdAt) &&
    names.has(c.modifiedBy) &&
    names.has(c.modifiedAt)
  );
}

/**
 * Returns a shallow copy of body with audit keys removed. Use before reading user input.
 */
export function stripClientAuditFields(body) {
  const out = { ...body };
  for (const k of STRIP_KEYS) {
    delete out[k];
  }
  return out;
}

/**
 * On INSERT: set creator and modifier to the same user and both timestamps to now.
 *
 * Parameters: body — merged field values; userId — current user; cols — name mapping.
 * Returns: new object with audit fields filled in.
 */
export function applyCreateAudit(body, userId, cols) {
  const now = new Date();
  return {
    ...body,
    [cols.createdBy]: userId,
    [cols.createdAt]: now,
    [cols.modifiedBy]: userId,
    [cols.modifiedAt]: now
  };
}

/**
 * On UPDATE: only touch last modifier and last modified time (created* stay historical).
 */
export function applyUpdateAudit(body, userId, cols) {
  const now = new Date();
  return {
    ...body,
    [cols.modifiedBy]: userId,
    [cols.modifiedAt]: now
  };
}
