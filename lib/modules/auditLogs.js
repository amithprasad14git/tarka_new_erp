// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

export function isAuditLogsModule(moduleKey) {
  return moduleKey === "audit_logs";
}

export function shouldHideAuditLogsRecordId(fieldName) {
  return fieldName === "record_id";
}

export function isAuditLogsJsonField(fieldName) {
  return fieldName === "old_data" || fieldName === "new_data";
}

export function isAuditLogsCreatedAtField(fieldName) {
  return fieldName === "created_at";
}
