/**
 * Shared post-save acknowledgement helpers for create/update CRUD responses and modal copy.
 */

import { rowValueForField } from "./gridRowValue";

/**
 * Build PUT response body with postCreateAck when the saved row has the configured field.
 */
export function buildPostCreateAckUpdateBody(moduleConfig, id, savedRow) {
  const body = { ok: true, id: Number(id) };
  const ackCfg = moduleConfig?.postCreateAck;
  if (!ackCfg?.field) return body;
  const raw = rowValueForField(savedRow, ackCfg.field);
  if (raw != null && String(raw).trim() !== "") {
    body.postCreateAck = { field: ackCfg.field, value: String(raw).trim() };
  }
  return body;
}

/**
 * Resolve modal title/hint for create vs edit (optional editTitle/editHint on postCreateAck).
 */
export function resolvePostCreateAckModalCopy(ackCfg, isEdit) {
  if (!ackCfg) return { title: "", hint: "" };
  const title = isEdit
    ? String(ackCfg.editTitle ?? ackCfg.title ?? "").trim()
    : String(ackCfg.title ?? "").trim();
  const hint = isEdit
    ? String(ackCfg.editHint ?? ackCfg.hint ?? "").trim()
    : String(ackCfg.hint ?? "").trim();
  return { title, hint };
}
