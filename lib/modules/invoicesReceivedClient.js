/**
 * Invoices Received — browser-only behaviour.
 * Do not import invoicesReceived.js (mysql2).
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { modules } from "../../config/modules";
import { formatViewCellValue } from "../formatViewCellValue";
import { getLookupRowLabelKey } from "../lookupLabelField";
import { rowValueForField } from "../gridRowValue";
import { NciCasePeekDetailContent } from "./newCaseInwardClient";
import { computeInvoicesReceivedAmounts } from "./invoicesReceivedAmounts";

export { computeInvoicesReceivedAmounts };

const INVOICE_SNAPSHOT_PARENT_FIELD_NAMES = new Set([
  "invoiceNo",
  "date",
  "caseNo",
  "grandTotal",
  "cancelledInvoice",
  "finalInvoice",
  "cancellationReason"
]);

const CASE_DETAIL_SNAPSHOT_ROWS = [
  { label: "Case No", nciField: "caseNo" },
  { label: "Bank", nciField: "unitLabel" },
  { label: "Branch", nciField: "branchLabel" },
  { label: "Borrower", nciField: "borrower" },
  { label: "Loan Category", nciField: "loanCategoryLabel" },
  { label: "Loan Type", nciField: "loanTypeLabel" }
];

const INVOICE_LOOKUP_FIELDS = [
  { field: "recoveryInvoice", moduleKey: "recovery_invoice", kind: "recovery" },
  { field: "sarfaesiInvoice", moduleKey: "sarfaesi_invoice", kind: "sarfaesi" },
  { field: "vehicleInvoice", moduleKey: "vehicle_invoice", kind: "vehicle" }
];

export function isInvoicesReceivedModule(moduleKey) {
  return moduleKey === "invoices_received";
}

export function isInvoicesReceivedInvoiceSnapshotModule(moduleKey) {
  return isInvoicesReceivedModule(moduleKey);
}

function invoiceLookupLabelKey(fieldName) {
  return `${fieldName}Label`;
}

function emptyDraft() {
  return {
    recoveryInvoice: "",
    sarfaesiInvoice: "",
    vehicleInvoice: "",
    recoveryInvoiceLabel: "",
    sarfaesiInvoiceLabel: "",
    vehicleInvoiceLabel: "",
    billedAmount: "",
    tdsPercentage: "",
    tdsAmount: "",
    receivedAmount: "",
    roundOff: ""
  };
}

function draftFromRow(row) {
  if (!row) return emptyDraft();
  return {
    recoveryInvoice: row.recoveryInvoice != null ? String(row.recoveryInvoice) : "",
    sarfaesiInvoice: row.sarfaesiInvoice != null ? String(row.sarfaesiInvoice) : "",
    vehicleInvoice: row.vehicleInvoice != null ? String(row.vehicleInvoice) : "",
    recoveryInvoiceLabel:
      row.recoveryInvoiceLabel != null ? String(row.recoveryInvoiceLabel) : "",
    sarfaesiInvoiceLabel: row.sarfaesiInvoiceLabel != null ? String(row.sarfaesiInvoiceLabel) : "",
    vehicleInvoiceLabel: row.vehicleInvoiceLabel != null ? String(row.vehicleInvoiceLabel) : "",
    billedAmount: row.billedAmount != null ? String(row.billedAmount) : "",
    tdsPercentage: row.tdsPercentage != null ? String(row.tdsPercentage) : "",
    tdsAmount: row.tdsAmount != null ? String(row.tdsAmount) : "",
    receivedAmount: row.receivedAmount != null ? String(row.receivedAmount) : "",
    roundOff: row.roundOff != null ? String(row.roundOff) : ""
  };
}

/** Ensure cleared invoice lookups also clear picker labels in form initialValues. */
function normalizeInvoiceLookupAutoValues(values) {
  const out = { ...values };
  for (const { field } of INVOICE_LOOKUP_FIELDS) {
    const labelKey = invoiceLookupLabelKey(field);
    const id = out[field] != null ? String(out[field]).trim() : "";
    if (!id) {
      out[field] = "";
      out[labelKey] = "";
    }
  }
  return out;
}

function activeKindFromDraft(draft) {
  if (draft.recoveryInvoice) return "recovery";
  if (draft.sarfaesiInvoice) return "sarfaesi";
  if (draft.vehicleInvoice) return "vehicle";
  return null;
}

function applyAmountsToDraft(draft) {
  const amounts = computeInvoicesReceivedAmounts({
    billedAmount: draft.billedAmount,
    tdsPercentage: draft.tdsPercentage,
    roundOff: draft.roundOff
  });
  return {
    ...draft,
    tdsPercentage: String(amounts.tdsPercentage),
    tdsAmount: String(amounts.tdsAmount),
    receivedAmount: String(amounts.receivedAmount)
  };
}

function formatInvoiceSnapshotCell(f, row) {
  if (f?.type === "lookup") {
    const labelKey = getLookupRowLabelKey(f);
    if (labelKey) {
      const labelVal = rowValueForField(row, labelKey);
      if (labelVal != null && String(labelVal).trim() !== "") return String(labelVal).trim();
    }
  }
  const raw = rowValueForField(row, f.name);
  if (raw == null || raw === "") return "—";
  const s = formatViewCellValue(f, raw);
  return String(s).trim() === "" ? "—" : String(s);
}

function snapshotCellText(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value).trim();
}

async function fetchCaseDetailRows(caseIdRaw) {
  const caseId = Number(caseIdRaw);
  if (!Number.isFinite(caseId) || caseId <= 0) return [];

  try {
    const res = await fetch(`/api/crud/new_case_inward/${caseId}`);
    const payload = await res.json().catch(() => null);
    const nci = payload?.data;
    if (!res.ok || !nci) return [];

    return CASE_DETAIL_SNAPSHOT_ROWS.map(({ label, nciField }) => {
      if (nciField === "caseNo") {
        return { label, value: snapshotCellText(rowValueForField(nci, "caseNo")) };
      }
      return { label, value: snapshotCellText(rowValueForField(nci, nciField)) };
    });
  } catch {
    return [];
  }
}

export async function buildInvoiceSnapshotDetail(payload, invoiceModuleKey) {
  const moduleConfig = modules[invoiceModuleKey];
  const parent = payload?.data;
  if (!moduleConfig || !parent) return null;

  const parentFields = (moduleConfig.fields || []).filter(
    (f) => f.showInView !== false && INVOICE_SNAPSHOT_PARENT_FIELD_NAMES.has(f.name)
  );

  const sections = [
    {
      title: "Invoice",
      rows: parentFields.map((f) => ({
        label: f.label || f.name,
        value: formatInvoiceSnapshotCell(f, parent)
      }))
    }
  ];

  const caseRows = await fetchCaseDetailRows(rowValueForField(parent, "caseNo"));
  if (caseRows.length) {
    sections.push({ title: "Case details", rows: caseRows });
  }

  return { sections, childBlocks: [], recordId: parent.id };
}

function resolveSnapshotTarget(draft) {
  const kind = activeKindFromDraft(draft);
  if (!kind) return { moduleKey: null, invoiceId: null };
  const field = INVOICE_LOOKUP_FIELDS.find((x) => x.kind === kind)?.field;
  const moduleKey = INVOICE_LOOKUP_FIELDS.find((x) => x.kind === kind)?.moduleKey;
  const invoiceId = field ? draft[field] : "";
  return { moduleKey, invoiceId: invoiceId ? String(invoiceId) : null };
}

export function useInvoicesReceivedClientModel({ moduleKey, config, editingRow, formKey }) {
  const enabled = isInvoicesReceivedModule(moduleKey);
  const [draft, setDraft] = useState(() => draftFromRow(editingRow));
  const [snapshotPreview, setSnapshotPreview] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDraft(emptyDraft());
      return;
    }
    setDraft(applyAmountsToDraft(draftFromRow(editingRow)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when record session changes
  }, [enabled, editingRow?.id, formKey]);

  const loadInvoiceSnapshot = useCallback(async (moduleKeyInv, invoiceIdRaw) => {
    const invoiceId = Number(invoiceIdRaw);
    if (!moduleKeyInv || !Number.isFinite(invoiceId) || invoiceId <= 0) {
      setSnapshotPreview(null);
      setSnapshotLoading(false);
      return;
    }
    setSnapshotLoading(true);
    try {
      const res = await fetch(`/api/crud/${moduleKeyInv}/${invoiceId}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.data) {
        setSnapshotPreview(null);
        return;
      }
      const detail = await buildInvoiceSnapshotDetail(payload, moduleKeyInv);
      setSnapshotPreview(detail ? { detail } : null);
    } catch {
      setSnapshotPreview(null);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const { moduleKey: mk, invoiceId } = resolveSnapshotTarget(draft);
    if (!mk || !invoiceId) {
      setSnapshotPreview(null);
      return;
    }
    void loadInvoiceSnapshot(mk, invoiceId);
  }, [enabled, draft.recoveryInvoice, draft.sarfaesiInvoice, draft.vehicleInvoice, loadInvoiceSnapshot]);

  const fetchInvoicePickMeta = useCallback(async (invoiceModuleKey, invoiceIdRaw) => {
    const invoiceId = Number(invoiceIdRaw);
    if (!invoiceModuleKey || !Number.isFinite(invoiceId) || invoiceId <= 0) return null;
    try {
      const res = await fetch(`/api/crud/${invoiceModuleKey}/${invoiceId}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.data) return null;
      const row = payload.data;
      const gt = rowValueForField(row, "grandTotal");
      const invoiceNo = rowValueForField(row, "invoiceNo");
      return {
        grandTotal: gt != null && String(gt).trim() !== "" ? String(gt) : "0",
        label: invoiceNo != null && String(invoiceNo).trim() !== "" ? String(invoiceNo).trim() : ""
      };
    } catch {
      return null;
    }
  }, []);

  const entryFieldUiOverrides = useMemo(() => {
    if (!enabled) return null;
    const parentRecordId =
      editingRow?.id != null && String(editingRow.id).trim() !== "" ? String(editingRow.id) : "";

    const pickerParent = parentRecordId ? { invoices_received_parent_id: parentRecordId } : {};

    const tdsBlur = () => {
      setDraft((prev) => applyAmountsToDraft(prev));
    };

    const tdsRawChange = (raw) => {
      setDraft((prev) => ({ ...prev, tdsPercentage: raw == null ? "" : String(raw) }));
    };

    return {
      recoveryInvoice: {
        lookup: {
          extraLovParams: {
            invoices_received_recovery_picker: "1",
            ...pickerParent
          }
        }
      },
      sarfaesiInvoice: {
        lookup: {
          extraLovParams: {
            invoices_received_sarfaesi_picker: "1",
            ...pickerParent
          }
        }
      },
      vehicleInvoice: {
        lookup: {
          extraLovParams: {
            invoices_received_vehicle_picker: "1",
            ...pickerParent
          }
        }
      },
      tdsPercentage: {
        onRawValueChange: tdsRawChange,
        onBlur: tdsBlur
      },
      roundOff: {
        emptyOptionLabel: "Select…"
      }
    };
  }, [enabled, editingRow?.id]);

  const entryReadOnlyFields = useMemo(() => {
    if (!enabled) return null;
    return {
      refNo: true,
      billedAmount: true,
      tdsAmount: true,
      receivedAmount: true
    };
  }, [enabled]);

  const autoValues = useMemo(() => {
    if (!enabled) return {};
    const out = normalizeInvoiceLookupAutoValues({ ...draft });
    if (out.roundOff == null || String(out.roundOff).trim() === "") {
      delete out.roundOff;
    }
    return out;
  }, [enabled, draft]);

  const snapshotHasSelection = Boolean(resolveSnapshotTarget(draft).invoiceId);

  function buildExclusiveInvoicePatch(activeField, invoiceVal, invoiceLabel) {
    const patch = {};
    for (const { field } of INVOICE_LOOKUP_FIELDS) {
      const labelKey = invoiceLookupLabelKey(field);
      const isActive = field === activeField;
      patch[field] = isActive ? invoiceVal : "";
      patch[labelKey] = isActive ? invoiceLabel : "";
    }
    return patch;
  }

  async function applyInvoicePick(kind, value) {
    const field = INVOICE_LOOKUP_FIELDS.find((x) => x.kind === kind)?.field;
    const moduleKeyInv = INVOICE_LOOKUP_FIELDS.find((x) => x.kind === kind)?.moduleKey;
    if (!field) return;

    const invoiceVal = value != null && String(value).trim() !== "" ? String(value) : "";

    if (!invoiceVal) {
      setDraft((prev) =>
        applyAmountsToDraft({
          ...prev,
          ...buildExclusiveInvoicePatch(field, "", ""),
          billedAmount: ""
        })
      );
      return;
    }

    const meta = await fetchInvoicePickMeta(moduleKeyInv, invoiceVal);
    setDraft((prev) =>
      applyAmountsToDraft({
        ...prev,
        ...buildExclusiveInvoicePatch(field, invoiceVal, meta?.label || ""),
        billedAmount: meta?.grandTotal != null ? meta.grandTotal : "0"
      })
    );
  }

  function handleFieldValueChange(fieldName, value) {
    if (!enabled) return false;

    if (fieldName === "recoveryInvoice") {
      void applyInvoicePick("recovery", value);
      return true;
    }
    if (fieldName === "sarfaesiInvoice") {
      void applyInvoicePick("sarfaesi", value);
      return true;
    }
    if (fieldName === "vehicleInvoice") {
      void applyInvoicePick("vehicle", value);
      return true;
    }
    if (fieldName === "roundOff") {
      setDraft((prev) => applyAmountsToDraft({ ...prev, roundOff: value == null ? "" : String(value) }));
      return true;
    }
    return false;
  }

  function mergeSubmitBody(body) {
    if (!enabled) return body;
    const next = { ...(body || {}) };
    next.recoveryInvoice = draft.recoveryInvoice || null;
    next.sarfaesiInvoice = draft.sarfaesiInvoice || null;
    next.vehicleInvoice = draft.vehicleInvoice || null;
    next.billedAmount = draft.billedAmount;
    next.tdsPercentage = draft.tdsPercentage;
    next.tdsAmount = draft.tdsAmount;
    next.receivedAmount = draft.receivedAmount;
    next.roundOff = draft.roundOff || null;
    return next;
  }

  function resetSnapshot() {
    setSnapshotPreview(null);
    setSnapshotLoading(false);
    setSnapshotModalOpen(false);
  }

  return {
    autoValues,
    entryFieldUiOverrides,
    entryReadOnlyFields,
    handleFieldValueChange,
    mergeSubmitBody,
    snapshotPreview,
    snapshotLoading,
    snapshotModalOpen,
    setSnapshotModalOpen,
    snapshotHasSelection,
    resetSnapshot
  };
}

export function InvoiceSnapshotModal({ open, onClose, loading, preview, hasSelection }) {
  if (!open) return null;
  const detail = preview?.detail;

  return (
    <div className="audit-json-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="audit-json-modal case-snapshot-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-snapshot-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="audit-json-modal-header">
          <h3 id="invoice-snapshot-modal-title" className="audit-json-modal-title">
            Invoice Snapshot
          </h3>
          <button type="button" className="audit-json-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="case-snapshot-modal-body">
          {!hasSelection ? (
            <div className="subtle" style={{ padding: "8px 0" }}>
              Select an invoice to view Snapshot.
            </div>
          ) : loading ? (
            <div className="pn-skeleton-card" aria-hidden>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="pn-skeleton-row">
                  <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                  <span className="pn-skeleton-cell pn-skeleton-cell-value" />
                </div>
              ))}
            </div>
          ) : detail ? (
            <NciCasePeekDetailContent detail={detail} />
          ) : (
            <div className="subtle" style={{ padding: "8px 0" }}>
              No snapshot data available for this invoice.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
