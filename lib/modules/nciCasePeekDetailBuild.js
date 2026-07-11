/**
 * Pure build helpers for NCI case peek / snapshot card layout (no React).
 */

import { getLookupRowLabelKey } from "../lookupLabelField";
import { rowValueForField } from "../gridRowValue";
import { formatViewCellValue } from "../formatViewCellValue";
import { formatAuditDateTimeDisplay } from "../formatAuditDateTime";

const NCI_MODAL_INR_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

function formatNciModalInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return NCI_MODAL_INR_FORMAT.format(n);
}

function formatNciModalClosureBalanceInr(value) {
  const s = formatNciModalInr(value);
  if (s === "—") return s;
  const i = s.indexOf("\u20B9");
  if (i === -1) return s;
  if (s.slice(i, i + 2) === "\u20B9 ") return s;
  return `${s.slice(0, i)}\u20B9 ${s.slice(i + 1)}`;
}

const NCI_PEEK_CASE_STATUS_FIELD_NAMES = new Set([
  "caseStatusUpdatedDate",
  "caseStatus",
  "caseStatusRemarks"
]);

const NCI_PEEK_FOOTER_FIELD_NAMES = new Set([
  "finalInvoice",
  "createdBy",
  "createdDate",
  "modifiedBy",
  "modifiedDate"
]);

/** Partition parent fields into peek card slices (summary → status → footer). */
export function partitionNciPeekParentFields(parentFields) {
  const summaryFields = [];
  const statusFields = [];
  const footerFields = [];
  for (const f of parentFields || []) {
    if (NCI_PEEK_CASE_STATUS_FIELD_NAMES.has(f.name)) {
      statusFields.push(f);
    } else if (NCI_PEEK_FOOTER_FIELD_NAMES.has(f.name)) {
      footerFields.push(f);
    } else {
      summaryFields.push(f);
    }
  }
  return { summaryFields, statusFields, footerFields };
}

function formatNciPeekParentCell(f, row) {
  if (!row) return "—";
  if (f.type === "lookup") {
    const l = rowValueForField(row, getLookupRowLabelKey(f));
    if (l != null && String(l).trim() !== "") return String(l).trim();
  }
  const raw = rowValueForField(row, f.name);
  if (raw == null || raw === "") return "—";
  if (f.name === "createdDate" || f.name === "modifiedDate") {
    const s = formatAuditDateTimeDisplay(raw);
    return s === "" ? "—" : s;
  }
  if (f.name === "closureBalance" && f.type === "number") {
    return formatNciModalClosureBalanceInr(raw);
  }
  const s = formatViewCellValue(f, raw);
  return String(s).trim() === "" ? "—" : String(s);
}

function mapNciPeekParentRows(fields, parent) {
  return (fields || []).map((f) => ({
    label: f.label || f.name,
    value: formatNciPeekParentCell(f, parent)
  }));
}

function buildNciPeekChildBlocks(moduleConfig, childPayload) {
  const blocks = [];
  for (const ct of moduleConfig?.childTables || []) {
    const key = ct.key || ct.table;
    if (key !== "amount_recovered") continue;
    const rows = childPayload[key];
    const cols = Array.isArray(ct.fields) ? ct.fields.slice() : [];
    const dataRows = Array.isArray(rows) && rows.length > 0 ? rows : [];
    blocks.push({
      key,
      title: ct.label || key,
      columns: cols,
      rows: dataRows
    });
  }
  return blocks;
}

/**
 * Build read-only peek/snapshot card detail from a loaded NCI payload + module config.
 * Used by the View-grid Peek modal (no React).
 */
export function buildNciReadonlyModalDetail(payload, moduleConfig) {
  const parent = payload?.data;
  if (!parent) return null;
  const childPayload = payload?.childTableRows && typeof payload.childTableRows === "object" ? payload.childTableRows : {};
  const parentFields = Array.isArray(moduleConfig?.fields) ? moduleConfig.fields.slice() : [];
  const { summaryFields, statusFields, footerFields } = partitionNciPeekParentFields(parentFields);
  const amountRecoveredBlocks = buildNciPeekChildBlocks(moduleConfig, childPayload);

  const cards = [
    {
      id: "summary",
      rows: mapNciPeekParentRows(summaryFields, parent)
    },
    {
      id: "statusAndRecovery",
      title: "Case Status Update",
      rows: mapNciPeekParentRows(statusFields, parent),
      childBlocks: amountRecoveredBlocks
    },
    {
      id: "footer",
      variant: "footer",
      rows: mapNciPeekParentRows(footerFields, parent)
    }
  ];

  return { cards, recordId: parent.id };
}
