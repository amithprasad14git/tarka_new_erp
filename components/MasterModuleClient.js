"use client";

/**
 * “Master” style screen for one module: single-record entry form, saved-rows grid, filters, and
 * Flux-style actions (save / view / clear). Uses RBAC from `/api/permissions/:module` for buttons.
 *
 * IMPORTANT ARCHITECTURE RULE (layman):
 * - This file is a generic container only.
 * - Do NOT add module-specific business checks, validation rules, or hardcoded module labels here.
 * - If behavior belongs to one module (like …/accounts_assets_investments/accounts_cash_deposit_withdraw),
 *   place that logic in `lib/modules/<module>*.js`, then call it from here.
 * - Think of this file as a "common frame" used by all modules.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { modules } from "../config/modules";
import { labelWithRequiredMark } from "../lib/formFieldLabel";
import { formatViewCellValue } from "../lib/formatViewCellValue";
// Grid rows may use mixed column name casing from MySQL; see lib/gridRowValue.js.
import { rowValueForField } from "../lib/gridRowValue";
import {
  fetchApiJson,
  formatApiErrorPayload,
  formatUserFacingError,
  isUnauthorizedMessage,
  readJsonResponse
} from "../lib/fetchClientError";
import { apiUserMessage } from "../lib/apiUserMessages";
import { getLookupRowLabelKey } from "../lib/lookupLabelField";
import {
  downloadNciBranchCopyPdf,
  downloadNciCaseDetailsPdf,
  fetchNciFinalStatusAckPayload,
  fetchSavedNciCaseNo,
  getNciAckPrintLabel,
  getNciBranchCopyPrintButtonText,
  getNciCaseStatusField,
  getNciCaseDetailsPrintButtonText,
  getNciDotTone,
  getNciEntryReadOnlyFields,
  getNciPrintTargetId,
  getNciSessionUnitForNewEntry,
  isNewCaseInwardModule,
  shouldShowNciChildTables,
  useNewCaseInwardClientModel,
  isNewCaseInwardAdmin,
  validateNciSubmitBody,
  useNciViewRecordModal,
  NciViewRecordPeekButton,
  NCI_VIEW_GRID_PEEK_COLUMN_HEADER
} from "../lib/modules/newCaseInwardClient";
import {
  downloadPublicNoticePdf,
  getPublicNoticeAckPrintLabel,
  getPublicNoticeAckPrintMode,
  getPublicNoticePrintButtonText,
  getPublicNoticePrintTargetId,
  isPublicNoticeModule,
  publicNoticeRefHintFromRow,
  shouldShowPublicNoticeAckOnEdit,
  usePublicNoticeClientModel
} from "../lib/modules/publicNoticeClient";
import { useCaseSnapshotModel } from "../lib/modules/caseSnapshotClient";
import { isTransferCaseModule, useTransferCaseClientModel } from "../lib/modules/transferCaseClient";
import {
  downloadRecoveryInvoicePdf,
  getRecoveryInvoiceAckPrintLabel,
  getRecoveryInvoicePrintButtonText,
  getRecoveryInvoicePrintTargetId,
  isRecoveryInvoiceModule,
  mergeRecoveryInvoiceEntryInitialValues,
  recoveryInvoiceRefHintFromRow,
  shouldShowRecoveryInvoiceAckOnEdit,
  useRecoveryInvoiceClientModel,
  validateRecoveryInvoiceClientSubmit
} from "../lib/modules/recoveryInvoiceClient";
import {
  downloadSarfaesiInvoicePdf,
  getSarfaesiInvoiceAckPrintLabel,
  getSarfaesiInvoicePrintButtonText,
  getSarfaesiInvoicePrintTargetId,
  isSarfaesiInvoiceModule,
  mergeSarfaesiInvoiceEntryInitialValues,
  sarfaesiInvoiceRefHintFromRow,
  shouldShowSarfaesiInvoiceAckOnEdit,
  useSarfaesiInvoiceClientModel,
  validateSarfaesiInvoiceClientSubmit
} from "../lib/modules/sarfaesiInvoiceClient";
import {
  downloadVehicleInvoicePdf,
  getVehicleInvoiceAckPrintLabel,
  getVehicleInvoicePrintButtonText,
  getVehicleInvoicePrintTargetId,
  isVehicleInvoiceModule,
  mergeVehicleInvoiceEntryInitialValues,
  shouldShowVehicleInvoiceAckOnEdit,
  useVehicleInvoiceClientModel,
  validateVehicleInvoiceClientSubmit,
  vehicleInvoiceRefHintFromRow
} from "../lib/modules/vehicleInvoiceClient";
import {
  isAccountsAssetsInvestmentsModule,
  useAccountsAssetsInvestmentsClientModel
} from "../lib/modules/accountsAssetsInvestmentsClient";
import {
  isAccountsExpenseVoucherModule,
  useAccountsExpenseVoucherClientModel
} from "../lib/modules/accountsExpenseVoucherClient";
// Loan Account UI: auto unit / NPA for restricted roles, cash vs non-cash NPA clearing — lib/modules/accountsLoanAcClient.js
import { isAccountsLoanAcModule, useAccountsLoanAcClientModel } from "../lib/modules/accountsLoanAcClient";
import {
  isAccountsCashDepositWithdrawModule,
  useAccountsCashDepositWithdrawClientModel
} from "../lib/modules/accountsCashDepositWithdrawClient";
import {
  isAccountsCurrentAcTransferModule,
  useAccountsCurrentAcTransferClientModel
} from "../lib/modules/accountsCurrentAcTransferClient";
import {
  applyReturnCaseSubmitBody,
  downloadReturnCasePdf,
  getReturnCaseAckPrintLabel,
  getReturnCasePrintButtonText,
  getReturnCasePrintTargetId,
  isReturnCaseModule,
  returnCaseRefHintFromRow,
  shouldShowReturnCaseAckOnEdit,
  useReturnCaseClientModel
} from "../lib/modules/returnCaseClient";
import { useSarfaesiCaseStatusUpdateClientModel } from "../lib/modules/sarfaesiCaseStatusUpdateClient";
import {
  InvoiceSnapshotModal,
  isInvoicesReceivedModule,
  useInvoicesReceivedClientModel
} from "../lib/modules/invoicesReceivedClient";
import {
  auditJsonPreview,
  buildAuditRecordLabel,
  formatAuditLookupCompareValue,
  formatAuditModuleLabel,
  isAuditLogsCreatedAtField,
  getAuditLogsGridColumnClass,
  isAuditLogsJsonField,
  isAuditLogsModule,
  isAuditLogsModuleColumn,
  isAuditLogsRecordLabelColumn,
  isPlaceholderAuditRecordLabel,
  resolveAuditFieldLabel,
  shouldHideAuditLogsRecordId
} from "../lib/modules/auditLogs";
import PostCreateAckModal from "./PostCreateAckModal";
import DynamicForm from "./DynamicForm";
import LoadingOverlay from "./LoadingOverlay";
import MasterActionsMenu from "./MasterActionsMenu";
import ModuleChildTablesPanel, { newChildRowDraft, validateIntegerOnlyRulesForRow } from "./ModuleChildTablesPanel";
import PaginationBar from "./PaginationBar";
import ToastNotice from "./ToastNotice";
import CaseSnapshotModal from "./CaseSnapshotModal";

function emptyChildRowsState(childTables) {
  if (!childTables?.length) return {};
  const o = {};
  // Start each child grid with one blank draft line ready to edit.
  for (const t of childTables) o[t.key || t.table] = [newChildRowDraft(t)];
  return o;
}

/** Maps GET `/api/crud/:module/:id` `childTableRows` into grid state (saved lines, stable `_rowId`). */
function childRowsStateFromApi(childTables, childTableRows) {
  if (!childTables?.length) return {};
  const o = {};
  for (const ct of childTables) {
    const key = ct.key || ct.table;
    const rows = childTableRows?.[key];
    if (Array.isArray(rows) && rows.length > 0) {
      o[key] = rows.map((r, idx) => {
        const { id: childId, ...rest } = r;
        return {
          ...rest,
          _rowId:
            childId != null
              ? `db-${childId}`
              : `tmp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`,
          _editing: false,
          _lineSaved: true
        };
      });
    } else {
      o[key] = [newChildRowDraft(ct)];
    }
  }
  return o;
}

function rowHasAnyContent(row, fields) {
  // Skip completely blank child lines when validating/saving the parent.
  for (const f of fields) {
    const v = row[f.name];
    if (f.type === "checkbox") {
      if (v === true || Number(v) === 1 || String(v).trim() === "1") return true;
      continue;
    }
    if (v !== null && v !== undefined && String(v).trim() !== "") return true;
  }
  return false;
}

function validateChildTableRows(moduleConfig, childRowsByKey) {
  const tables = moduleConfig.childTables || [];
  for (const ct of tables) {
    const key = ct.key || ct.table;
    const rows = childRowsByKey[key] || [];
    const fields = ct.fields || [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!rowHasAnyContent(row, fields)) continue;
      // Each child line must be saved individually before the parent can submit.
      if (row._editing || !row._lineSaved) {
        return `${ct.label || key}, row ${i + 1}: use Save on the line before saving the parent record.`;
      }
      for (const f of fields) {
        if (!f.required) continue;
        const v = row[f.name];
        const empty = v === null || v === undefined || (typeof v === "string" && !String(v).trim());
        if (empty) {
          return `${ct.label || key}, row ${i + 1}: ${f.label || f.name} is required.`;
        }
        if (f.type === "number") {
          const n = Number(v);
          if (!Number.isFinite(n)) {
            return `${ct.label || key}, row ${i + 1}: ${f.label || f.name} must be a valid number.`;
          }
        }
        if (f.type === "checkbox") {
          const n = v === true ? 1 : v === false ? 0 : Number(v);
          if (n !== 0 && n !== 1) {
            return `${ct.label || key}, row ${i + 1}: ${f.label || f.name} must be checked or unchecked (0/1).`;
          }
        }
      }
      for (const f of fields) {
        const rwc = f.requiredWhenChecked;
        if (!rwc?.checkboxField) continue;
        const cbName = rwc.checkboxField;
        const cv = row[cbName];
        const checked =
          cv === true || Number(cv) === 1 || (typeof cv === "string" && String(cv).trim() === "1");
        if (!checked) continue;
        const v = row[f.name];
        const empty = v === null || v === undefined || (typeof v === "string" && !String(v).trim());
        if (empty) {
          const cb = fields.find((x) => x.name === cbName);
          return `${ct.label || key}, row ${i + 1}: ${f.label || f.name} is required when ${cb?.label || cbName} is selected.`;
        }
      }
      const intOnlyErr = validateIntegerOnlyRulesForRow(ct, row);
      if (intOnlyErr) return `${ct.label || key}, row ${i + 1}: ${intOnlyErr}`;
    }
  }
  return null;
}

function stripChildRowsForApi(childTables, childRowsByKey) {
  const out = {};
  for (const ct of childTables) {
    const key = ct.key || ct.table;
    const fields = ct.fields || [];
    // Only send saved lines that have at least one non-empty cell.
    out[key] = (childRowsByKey[key] || [])
      .filter((row) => row._lineSaved && rowHasAnyContent(row, fields))
      .map((row) => {
        const obj = {};
        // Preserve DB child id in edit mode so server can detect unchanged legacy rows.
        const rowIdText = String(row?._rowId ?? "").trim();
        if (rowIdText.startsWith("db-")) {
          const n = Number(rowIdText.slice(3));
          if (Number.isFinite(n) && n > 0) obj.id = n;
        } else if (Number.isFinite(Number(row?.id)) && Number(row.id) > 0) {
          obj.id = Number(row.id);
        }
        for (const f of fields) {
          const v = row[f.name];
          if (f.type === "number") {
            if (v === "" || v == null) obj[f.name] = null;
            else {
              const n = Number(v);
              if (!Number.isFinite(n)) obj[f.name] = null;
              else obj[f.name] = f.integerOnly ? Math.trunc(n) : n;
            }
          } else if (f.type === "checkbox") {
            obj[f.name] = v === true || Number(v) === 1 ? 1 : 0;
          } else if (v === "") {
            obj[f.name] = null;
          } else {
            obj[f.name] = v;
          }
        }
        return obj;
      });
  }
  return out;
}

function prettyAuditJsonText(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function parseAuditJson(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function looksLikeDateField(fieldName) {
  const k = String(fieldName || "").toLowerCase();
  return k.includes("date") || k.endsWith("_at") || k.endsWith("at");
}

function isDateOnlyField(fieldName) {
  const k = String(fieldName || "").toLowerCase();
  // Business date fields that should not show time.
  return (
    k === "npadate" ||
    k === "entrustmentdate" ||
    k === "date" ||
    k.endsWith("_date")
  );
}

function formatReadableDateTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

function formatReadableDateOnly(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function valueTextForCompare(fieldName, v, { targetModuleKey, snapshotRow, contextRow } = {}) {
  if (targetModuleKey) {
    const lookupText = formatAuditLookupCompareValue(
      targetModuleKey,
      fieldName,
      snapshotRow,
      contextRow
    );
    if (lookupText != null) return lookupText;
  }
  if (v == null) return "";
  // Audit logs store many date fields in ISO; convert to business-friendly display format.
  if (looksLikeDateField(fieldName) && (typeof v === "string" || typeof v === "number")) {
    if (isDateOnlyField(fieldName)) return formatReadableDateOnly(v);
    return formatReadableDateTime(v);
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function buildAuditCompareTitle({ targetModule, recordLabel, recordId }) {
  const moduleLabel = formatAuditModuleLabel(targetModule);
  const rec =
    recordLabel != null && String(recordLabel).trim() !== ""
      ? String(recordLabel).trim()
      : recordId != null && String(recordId).trim() !== ""
        ? `ID ${recordId}`
        : "";
  const head = [moduleLabel, rec].filter(Boolean).join(" — ");
  return head ? `${head} — Old vs New` : "Old vs New";
}

function buildAuditCompareSubtitle({ auditEntryId, action, createdAt, fetchFailed, recordId }) {
  const bits = [];
  if (auditEntryId != null && String(auditEntryId).trim() !== "") {
    bits.push(`Audit entry #${auditEntryId}`);
  }
  if (action != null && String(action).trim() !== "") bits.push(String(action).trim());
  if (createdAt != null && String(createdAt).trim() !== "") {
    bits.push(formatReadableDateTime(createdAt));
  }
  if (fetchFailed && recordId != null) {
    bits.push(`Record ID ${recordId} (deleted or unavailable)`);
  }
  return bits.join(" · ");
}

function buildAuditCompareRows(
  oldRaw,
  newRaw,
  targetModuleKey,
  contextRow = null,
  enrichedOld = null,
  enrichedNew = null
) {
  const oldObj = parseAuditJson(oldRaw);
  const newObj = parseAuditJson(newRaw);
  if (!oldObj && !newObj) return [];
  const keys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {})
  ]);
  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((k) => {
      const oldSnap = enrichedOld ?? oldObj;
      const newSnap = enrichedNew ?? newObj;
      const oldVal = valueTextForCompare(k, oldObj?.[k] ?? "", {
        targetModuleKey,
        snapshotRow: oldSnap,
        contextRow
      });
      const newVal = valueTextForCompare(k, newObj?.[k] ?? "", {
        targetModuleKey,
        snapshotRow: newSnap,
        contextRow
      });
      return {
        key: k,
        label: targetModuleKey ? resolveAuditFieldLabel(targetModuleKey, k) : k,
        oldVal,
        newVal
      };
    });
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v4h5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M7 6l1 16h8l1-16" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 18l-4 1 1-4 12.5-11.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function PrintCaseDetailsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

/**
 * Generic "master" screen:
 * - Entry mode: shows full-width form; Save submits and switches to View.
 * - View mode: shows full-width table with checkbox selection; Edit/Delete act on selected row.
 * - Buttons are RBAC-aware for the configured module key.
 *
 * @param {{ moduleKey: string, isActive?: boolean }} props
 */
export default function MasterModuleClient({ moduleKey, isActive = true }) {
  const config = modules[moduleKey];
  const isReadOnly = Boolean(config?.readOnly);

  const [data, setData] = useState([]);
  const [toast, setToast] = useState(null);

  const [editingRow, setEditingRow] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const formId = `${moduleKey}-form`;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [viewMode, setViewMode] = useState(false);
  // In read-only modules, the entry form is hidden and the UI starts directly in view.
  const effectiveViewMode = isReadOnly ? true : viewMode;
  const [selectedId, setSelectedId] = useState(null);
  // View-mode column filters (one filter input per table column).
  const [viewColumnFilterInput, setViewColumnFilterInput] = useState({});
  const [viewColumnFilters, setViewColumnFilters] = useState({});
  const [permissions, setPermissions] = useState({
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    role: null,
    unit: null
  });
  /** Blocks double-submit and shows full-screen loading overlay during I/O. */
  const [busy, setBusy] = useState(false);
  /** When `modules[moduleKey].postCreateAck` is set and create returns `postCreateAck`, show modal before view. */
  const [postCreateAckOpen, setPostCreateAckOpen] = useState(null);
  /** Audit Logs only: side-by-side old/new compare popup. */
  const [auditCompareDialog, setAuditCompareDialog] = useState(null);

  useEffect(() => {
    const entryId = auditCompareDialog?.auditEntryId;
    if (!auditCompareDialog?.targetModule || auditCompareDialog.recordId == null || entryId == null) {
      return;
    }

    // Fetch live row + enriched snapshots when user opens audit compare dialog.
    let cancelled = false;
    (async () => {
      try {
        const mod = encodeURIComponent(String(auditCompareDialog.targetModule));
        const rid = encodeURIComponent(String(auditCompareDialog.recordId));
        const res = await fetch(`/api/crud/${mod}/${rid}`);
        if (cancelled) return;
        if (!res.ok) {
          setAuditCompareDialog((prev) => {
            if (!prev || prev.auditEntryId !== entryId) return prev;
            return {
              ...prev,
              contextRow: null,
              fetchFailed: res.status === 404,
              subtitle: buildAuditCompareSubtitle({
                auditEntryId: prev.auditEntryId,
                action: prev.action,
                createdAt: prev.createdAt,
                fetchFailed: res.status === 404,
                recordId: prev.recordId
              })
            };
          });
          return;
        }
        const json = await res.json();
        const contextRow = json?.data ?? null;
        const label = buildAuditRecordLabel(
          auditCompareDialog.targetModule,
          contextRow,
          auditCompareDialog.recordId
        );

        const oldObj = parseAuditJson(auditCompareDialog.oldRaw);
        const newObj = parseAuditJson(auditCompareDialog.newRaw);
        let enrichedOld = null;
        let enrichedNew = null;
        if (oldObj || newObj) {
          try {
            const enrichRes = await fetch("/api/audit-logs/enrich-compare", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                moduleKey: auditCompareDialog.targetModule,
                oldData: oldObj,
                newData: newObj
              })
            });
            if (enrichRes.ok) {
              const enriched = await enrichRes.json();
              enrichedOld = enriched?.oldData ?? null;
              enrichedNew = enriched?.newData ?? null;
            }
          } catch {
            /* compare still works with raw ids */
          }
        }

        if (cancelled) return;
        setAuditCompareDialog((prev) => {
          if (!prev || prev.auditEntryId !== entryId) return prev;
          const recordLabel =
            label && isPlaceholderAuditRecordLabel(prev.recordLabel) ? label : prev.recordLabel;
          return {
            ...prev,
            contextRow,
            enrichedOld,
            enrichedNew,
            recordLabel,
            title: buildAuditCompareTitle({
              targetModule: prev.targetModule,
              recordLabel,
              recordId: prev.recordId
            }),
            fetchFailed: false,
            subtitle: buildAuditCompareSubtitle({
              auditEntryId: prev.auditEntryId,
              action: prev.action,
              createdAt: prev.createdAt,
              fetchFailed: false,
              recordId: prev.recordId
            })
          };
        });
      } catch {
        /* ignore network errors for compare context */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auditCompareDialog?.auditEntryId]);

  /** In-memory rows for `config.childTables`, keyed by each child table's `key` (fallback: SQL `table` name). */
  const [childRowsByKey, setChildRowsByKey] = useState(() =>
    emptyChildRowsState(modules[moduleKey]?.childTables)
  );
  const recoveryInvoiceClient = useRecoveryInvoiceClientModel({
    moduleKey,
    config,
    editingRow,
    formKey,
    childRowsByKey
  });
  const sarfaesiInvoiceClient = useSarfaesiInvoiceClientModel({
    moduleKey,
    config,
    editingRow,
    formKey,
    childRowsByKey
  });
  const vehicleInvoiceClient = useVehicleInvoiceClientModel({
    moduleKey,
    config,
    editingRow,
    formKey,
    childRowsByKey
  });
  const recordsFetchKeyRef = useRef("");
  const permissionsFetchKeyRef = useRef("");

  const title = useMemo(() => config?.label || moduleKey, [config, moduleKey]);
  const isNciModule = isNewCaseInwardModule(moduleKey);
  const isPublicNotice = isPublicNoticeModule(moduleKey);
  const isRecoveryInvoice = isRecoveryInvoiceModule(moduleKey);
  const isSarfaesiInvoice = isSarfaesiInvoiceModule(moduleKey);
  const isVehicleInvoice = isVehicleInvoiceModule(moduleKey);
  const isReturnCase = isReturnCaseModule(moduleKey);
  const isTransferCase = isTransferCaseModule(moduleKey);
  const isAccountsAssetsInvestments = isAccountsAssetsInvestmentsModule(moduleKey);
  const isAccountsExpenseVoucher = isAccountsExpenseVoucherModule(moduleKey);
  const isAccountsLoanAc = isAccountsLoanAcModule(moduleKey);
  const isAccountsCashDepositWithdraw = isAccountsCashDepositWithdrawModule(moduleKey);
  const isAccountsCurrentAcTransfer = isAccountsCurrentAcTransferModule(moduleKey);
  const isInvoicesReceived = isInvoicesReceivedModule(moduleKey);
  const isAuditLogs = isAuditLogsModule(moduleKey);
  const isNciAdmin = isNewCaseInwardAdmin(moduleKey, permissions.role);
  const transferClient = useTransferCaseClientModel({
    moduleKey,
    editingRow,
    formKey,
    sessionRole: permissions.role,
    sessionUnit: permissions.unit
  });

  const accountsAssetsClient = useAccountsAssetsInvestmentsClientModel({
    moduleKey,
    editingRow,
    formKey,
    sessionRole: permissions.role,
    sessionUnit: permissions.unit
  });

  const accountsExpenseVoucherClient = useAccountsExpenseVoucherClientModel({
    moduleKey,
    editingRow,
    formKey,
    sessionRole: permissions.role,
    sessionUnit: permissions.unit
  });

  const accountsLoanAcClient = useAccountsLoanAcClientModel({
    moduleKey,
    editingRow,
    formKey,
    sessionRole: permissions.role,
    sessionUnit: permissions.unit
  });

  const accountsCashDwClient = useAccountsCashDepositWithdrawClientModel({
    moduleKey,
    editingRow,
    formKey,
    sessionRole: permissions.role,
    sessionUnit: permissions.unit
  });

  const accountsCurrentAcTransferClient = useAccountsCurrentAcTransferClientModel({
    moduleKey,
    editingRow,
    formKey
  });

  const invoicesReceivedClient = useInvoicesReceivedClientModel({
    moduleKey,
    config,
    editingRow,
    formKey
  });

  /** Role 2 new entry: key on unit only (not NPA). NPA changes on Cash/non-Cash must not remount — uncontrolled fields would reset; NPA syncs via initialValues + LookupSelect. */
  const accountsAssetsDynamicFormKeySuffix = useMemo(() => {
    if (!isAccountsAssetsInvestments || editingRow) return "";
    if (Number(permissions.role) !== 2) return "";
    const u = accountsAssetsClient.autoValues?.unit;
    return u != null && String(u).trim() !== "" ? String(u) : "";
  }, [isAccountsAssetsInvestments, editingRow, permissions.role, accountsAssetsClient.autoValues?.unit]);

  const accountsExpenseVoucherDynamicFormKeySuffix = useMemo(() => {
    if (!isAccountsExpenseVoucher || editingRow) return "";
    if (Number(permissions.role) !== 2) return "";
    const u = accountsExpenseVoucherClient.autoValues?.unit;
    return u != null && String(u).trim() !== "" ? String(u) : "";
  }, [isAccountsExpenseVoucher, editingRow, permissions.role, accountsExpenseVoucherClient.autoValues?.unit]);

  /** Role 2 new entry: key on unit only. Including npa in the key remounts the form when Cash clears NPA and wipes other fields (uncontrolled inputs). NPA still updates via merged initialValues + LookupSelect initialValue effect. */
  const accountsLoanAcDynamicFormKeySuffix = useMemo(() => {
    if (!isAccountsLoanAc || editingRow) return "";
    if (Number(permissions.role) !== 2) return "";
    const u = accountsLoanAcClient.autoValues?.unit;
    return u != null && String(u).trim() !== "" ? String(u) : "";
  }, [isAccountsLoanAc, editingRow, permissions.role, accountsLoanAcClient.autoValues?.unit]);

  const accountsCashDwDynamicFormKeySuffix = useMemo(() => {
    if (!isAccountsCashDepositWithdraw || editingRow) return "";
    if (Number(permissions.role) !== 2) return "";
    const av = accountsCashDwClient.autoValues || {};
    const u = av.unit != null ? String(av.unit) : "";
    const n = av.npaCurrentAc != null ? String(av.npaCurrentAc) : "";
    return `${u}__${n}`;
  }, [isAccountsCashDepositWithdraw, editingRow, permissions.role, accountsCashDwClient.autoValues]);

  /** New Case Inward: role 2 (non-admin) uses session unit on new entry only; role 1 picks any unit. */
  const newCaseInwardSessionUnit = useMemo(
    () => getNciSessionUnitForNewEntry(moduleKey, permissions.role, permissions.unit),
    [moduleKey, permissions.role, permissions.unit]
  );

  const entryFormInitialValues = useMemo(() => {
    let v = editingRow ? { ...editingRow } : {};
    if (newCaseInwardSessionUnit != null) v.unit = newCaseInwardSessionUnit;
    if (isTransferCase) {
      return { ...v, ...transferClient.autoValues };
    }
    if (isAccountsCurrentAcTransfer) {
      return { ...v, ...accountsCurrentAcTransferClient.autoValues };
    }
    if (isAccountsCashDepositWithdraw) {
      return { ...v, ...accountsCashDwClient.autoValues };
    }
    if (isAccountsAssetsInvestments) {
      return { ...v, ...accountsAssetsClient.autoValues };
    }
    if (isAccountsExpenseVoucher) {
      return { ...v, ...accountsExpenseVoucherClient.autoValues };
    }
    if (isAccountsLoanAc) {
      return { ...v, ...accountsLoanAcClient.autoValues };
    }
    if (isInvoicesReceived) {
      return { ...v, ...invoicesReceivedClient.autoValues };
    }
    v = mergeRecoveryInvoiceEntryInitialValues(moduleKey, editingRow, v);
    v = mergeSarfaesiInvoiceEntryInitialValues(moduleKey, editingRow, v);
    v = mergeVehicleInvoiceEntryInitialValues(moduleKey, editingRow, v);
    return v;
  }, [
    editingRow,
    newCaseInwardSessionUnit,
    isTransferCase,
    transferClient.autoValues,
    isAccountsCurrentAcTransfer,
    accountsCurrentAcTransferClient.autoValues,
    isAccountsCashDepositWithdraw,
    accountsCashDwClient.autoValues,
    isAccountsAssetsInvestments,
    accountsAssetsClient.autoValues,
    isAccountsExpenseVoucher,
    accountsExpenseVoucherClient.autoValues,
    isAccountsLoanAc,
    accountsLoanAcClient.autoValues,
    isInvoicesReceived,
    invoicesReceivedClient.autoValues,
    moduleKey
  ]);

  const entryFormReadOnlyFields = useMemo(() => {
    if (isInvoicesReceived) return invoicesReceivedClient.entryReadOnlyFields;
    if (isVehicleInvoiceModule(moduleKey)) return vehicleInvoiceClient.entryReadOnlyFields;
    if (isSarfaesiInvoiceModule(moduleKey)) return sarfaesiInvoiceClient.entryReadOnlyFields;
    if (isRecoveryInvoiceModule(moduleKey)) return recoveryInvoiceClient.entryReadOnlyFields;
    if (isTransferCase) return transferClient.entryReadOnlyFields;
    if (isAccountsCurrentAcTransfer) return accountsCurrentAcTransferClient.entryReadOnlyFields;
    if (isAccountsCashDepositWithdraw) return accountsCashDwClient.entryReadOnlyFields;
    if (isAccountsAssetsInvestments) return accountsAssetsClient.entryReadOnlyFields;
    if (isAccountsExpenseVoucher) return accountsExpenseVoucherClient.entryReadOnlyFields;
    if (isAccountsLoanAc) return accountsLoanAcClient.entryReadOnlyFields;
    return getNciEntryReadOnlyFields(moduleKey, editingRow, permissions.role, permissions.unit);
  }, [
    moduleKey,
    editingRow,
    permissions.role,
    permissions.unit,
    transferClient.entryReadOnlyFields,
    isTransferCase,
    isAccountsCurrentAcTransfer,
    accountsCurrentAcTransferClient.entryReadOnlyFields,
    isAccountsCashDepositWithdraw,
    accountsCashDwClient.entryReadOnlyFields,
    isAccountsAssetsInvestments,
    accountsAssetsClient.entryReadOnlyFields,
    isAccountsExpenseVoucher,
    accountsExpenseVoucherClient.entryReadOnlyFields,
    isAccountsLoanAc,
    accountsLoanAcClient.entryReadOnlyFields,
    recoveryInvoiceClient.entryReadOnlyFields,
    sarfaesiInvoiceClient.entryReadOnlyFields,
    vehicleInvoiceClient.entryReadOnlyFields,
    isInvoicesReceived,
    invoicesReceivedClient.entryReadOnlyFields
  ]);

  const caseSnapshot = useCaseSnapshotModel({ moduleKey, editingRow });
  const publicNoticeClient = usePublicNoticeClientModel({ moduleKey, editingRow });
  const createChildDraftRow = useCallback((ct) => newChildRowDraft(ct), []);
  const returnCaseClient = useReturnCaseClientModel({
    moduleKey,
    editingRow,
    formKey,
    childTables: config?.childTables || [],
    createDraftRow: createChildDraftRow,
    setChildRowsByKey
  });
  const returnCaseEntryFormInitialValues = useMemo(() => {
    if (!isReturnCase) return entryFormInitialValues;
    return { ...entryFormInitialValues, ...returnCaseClient.autoValues };
  }, [isReturnCase, entryFormInitialValues, returnCaseClient.autoValues]);
  const recoveryInvoiceEntryFormInitialValues = useMemo(() => {
    if (!isRecoveryInvoice) return entryFormInitialValues;
    return { ...entryFormInitialValues, ...recoveryInvoiceClient.autoValues };
  }, [isRecoveryInvoice, entryFormInitialValues, recoveryInvoiceClient.autoValues]);
  const sarfaesiInvoiceEntryFormInitialValues = useMemo(() => {
    if (!isSarfaesiInvoice) return entryFormInitialValues;
    return { ...entryFormInitialValues, ...sarfaesiInvoiceClient.autoValues };
  }, [isSarfaesiInvoice, entryFormInitialValues, sarfaesiInvoiceClient.autoValues]);
  const vehicleInvoiceEntryFormInitialValues = useMemo(() => {
    if (!isVehicleInvoice) return entryFormInitialValues;
    return { ...entryFormInitialValues, ...vehicleInvoiceClient.autoValues };
  }, [isVehicleInvoice, entryFormInitialValues, vehicleInvoiceClient.autoValues]);
  const sarfaesiCaseStatusUpdateClient = useSarfaesiCaseStatusUpdateClientModel({
    moduleKey,
    editingRow,
    formKey,
    childTables: config?.childTables || [],
    createDraftRow: createChildDraftRow,
    setChildRowsByKey
  });

  const nciClient = useNewCaseInwardClientModel({
    moduleKey,
    isActive,
    config,
    editingRow,
    entryFormInitialValues,
    isAdmin: isNciAdmin
  });

  /** NCI: grid “View record” for `_canEdit === false` loads this modal instead of entry mode (`newCaseInwardClient.js`). */
  const nciViewRecordModal = useNciViewRecordModal({ moduleKey, moduleConfig: config });

  const entryFieldUiOverrides = useMemo(() => {
    if (invoicesReceivedClient.entryFieldUiOverrides) return invoicesReceivedClient.entryFieldUiOverrides;
    if (vehicleInvoiceClient.entryFieldUiOverrides) return vehicleInvoiceClient.entryFieldUiOverrides;
    if (sarfaesiInvoiceClient.entryFieldUiOverrides) return sarfaesiInvoiceClient.entryFieldUiOverrides;
    if (recoveryInvoiceClient.entryFieldUiOverrides) return recoveryInvoiceClient.entryFieldUiOverrides;
    if (publicNoticeClient.entryFieldUiOverrides) return publicNoticeClient.entryFieldUiOverrides;
    if (returnCaseClient.entryFieldUiOverrides) return returnCaseClient.entryFieldUiOverrides;
    if (sarfaesiCaseStatusUpdateClient.entryFieldUiOverrides)
      return sarfaesiCaseStatusUpdateClient.entryFieldUiOverrides;
    if (accountsCurrentAcTransferClient.entryFieldUiOverrides)
      return accountsCurrentAcTransferClient.entryFieldUiOverrides;
    if (accountsCashDwClient.entryFieldUiOverrides) return accountsCashDwClient.entryFieldUiOverrides;
    if (accountsAssetsClient.entryFieldUiOverrides) return accountsAssetsClient.entryFieldUiOverrides;
    if (accountsExpenseVoucherClient.entryFieldUiOverrides)
      return accountsExpenseVoucherClient.entryFieldUiOverrides;
    if (accountsLoanAcClient.entryFieldUiOverrides) return accountsLoanAcClient.entryFieldUiOverrides;
    if (transferClient.entryFieldUiOverrides) return transferClient.entryFieldUiOverrides;
    return nciClient.entryFieldUiOverrides;
  }, [
    invoicesReceivedClient.entryFieldUiOverrides,
    vehicleInvoiceClient.entryFieldUiOverrides,
    sarfaesiInvoiceClient.entryFieldUiOverrides,
    recoveryInvoiceClient.entryFieldUiOverrides,
    publicNoticeClient.entryFieldUiOverrides,
    returnCaseClient.entryFieldUiOverrides,
    sarfaesiCaseStatusUpdateClient.entryFieldUiOverrides,
    accountsCurrentAcTransferClient.entryFieldUiOverrides,
    accountsCashDwClient.entryFieldUiOverrides,
    accountsAssetsClient.entryFieldUiOverrides,
    accountsExpenseVoucherClient.entryFieldUiOverrides,
    accountsLoanAcClient.entryFieldUiOverrides,
    transferClient.entryFieldUiOverrides,
    nciClient.entryFieldUiOverrides
  ]);

  const nciDisableLookupRemoteByField = nciClient.disableLookupRemoteByField;
  const childFieldUiOverrides = nciClient.childFieldUiOverrides;
  const entryModeConfig = useMemo(() => {
    if (vehicleInvoiceClient.entryModeConfig) return vehicleInvoiceClient.entryModeConfig;
    if (sarfaesiInvoiceClient.entryModeConfig) return sarfaesiInvoiceClient.entryModeConfig;
    if (recoveryInvoiceClient.entryModeConfig) return recoveryInvoiceClient.entryModeConfig;
    return nciClient.entryModeConfig;
  }, [
    vehicleInvoiceClient.entryModeConfig,
    sarfaesiInvoiceClient.entryModeConfig,
    recoveryInvoiceClient.entryModeConfig,
    nciClient.entryModeConfig
  ]);

  const showEntryChildTables = useMemo(() => {
    return shouldShowNciChildTables(moduleKey, Boolean(config?.childTables?.length), editingRow);
  }, [config?.childTables, moduleKey, editingRow]);

  /** Client-side guard; server still enforces RBAC. List rows include `_canEdit` when row-level scope applies. */
  const canSave = useMemo(() => {
    if (config?.readOnly) return false;
    if (editingRow) {
      if (!permissions.canEdit) return false;
      if (editingRow._canEdit === false) return false;
      return true;
    }
    return permissions.canCreate;
  }, [config?.readOnly, editingRow, permissions.canEdit, permissions.canCreate]);

  const canSaveThisRow = !editingRow || editingRow._canEdit !== false;

  const selectedRow = useMemo(() => {
    if (selectedId == null) return null;
    return data.find((r) => String(r.id) === String(selectedId)) ?? null;
  }, [data, selectedId]);

  const canOpenSelectedRecord = useMemo(() => {
    if (!selectedId || !selectedRow) return false;
    if (isNewCaseInwardModule(moduleKey) && permissions.canView && selectedRow._canEdit === false) return true;
    if (!permissions.canEdit) return false;
    return selectedRow._canEdit !== false;
  }, [selectedId, selectedRow, permissions.canEdit, permissions.canView, moduleKey]);

  // View table columns: per-field `showInView` in config/modules.js (default true if omitted).
  const viewFieldConfigs = useMemo(() => {
    return (config?.fields || []).filter((f) => {
      if (f.showInView === false) return false;
      if (isAuditLogs && shouldHideAuditLogsRecordId(f.name)) return false;
      return true;
    });
  }, [config, moduleKey]);
  const auditLogsCompareEnabled = isAuditLogs;
  // Audit logs acts like a report screen, not a data-entry module.
  const auditLogsSimpleView = isAuditLogs;
  // New Case Inward uses a dot marker instead of row background tint for case status.
  const nciStatusDotEnabled = isNewCaseInwardModule(moduleKey);
  const nciViewPeekEnabled = isNewCaseInwardModule(moduleKey) && permissions.canView;

  const nciCaseStatusField = useMemo(() => getNciCaseStatusField(config, moduleKey), [moduleKey, config]);

  // Auto-dismiss toast after a short delay.
  useEffect(() => {
    if (!toast) return;
    const timeoutMs = toast.kind === "error" ? 9000 : 3000;
    const t = setTimeout(() => setToast(null), timeoutMs);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setChildRowsByKey(emptyChildRowsState(config?.childTables));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- new blank grid when form session or module changes only
  }, [formKey, moduleKey]);

  function normalizeToastMessage(kind, message) {
    const text = String(message || "").trim();
    if (kind !== "error") return text;
    if (isUnauthorizedMessage(text)) {
      return apiUserMessage("sessionExpired");
    }
    return text;
  }

  function showToast(kind, message) {
    setToast({ kind, message: normalizeToastMessage(kind, message) });
  }

  function handleEntryFieldValueChange(fieldName, value) {
    // Let snapshot model observe caseNo changes first.
    caseSnapshot.handleCaseFieldValueChange(fieldName, value);
    if (invoicesReceivedClient.handleFieldValueChange(fieldName, value)) return;
    if (recoveryInvoiceClient.handleFieldValueChange(fieldName, value)) return;
    if (sarfaesiInvoiceClient.handleFieldValueChange(fieldName, value)) return;
    if (vehicleInvoiceClient.handleFieldValueChange(fieldName, value)) return;
    if (nciClient.onFieldValueChange(fieldName, value)) {
      return;
    }
    if (accountsCurrentAcTransferClient.handleFieldValueChange(fieldName, value)) return;
    if (accountsCashDwClient.handleFieldValueChange(fieldName, value)) return;
    if (accountsAssetsClient.handleFieldValueChange(fieldName, value)) return;
    if (accountsExpenseVoucherClient.handleFieldValueChange(fieldName, value)) return;
    // accounts_loan_ac: cash clears NPA lookup; non-cash refetches first current a/c for unit (see accountsLoanAcClient.js).
    if (accountsLoanAcClient.handleFieldValueChange(fieldName, value)) return;
    if (transferClient.handleFieldValueChange(fieldName, value)) return;
    if (returnCaseClient.handleFieldValueChange(fieldName, value)) return;
  }

  const loadRecords = async () => {
    setBusy(true);
    try {
      // Build the same query format used by `/api/crud/[module]`:
      // column filters are `f_<fieldName>` (supported by the API).
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: "id",
        sortDir: "desc"
      });

      for (const [fieldName, rawValue] of Object.entries(viewColumnFilters || {})) {
        const value = rawValue == null ? "" : String(rawValue).trim();
        if (!value) continue;
        // Exact filter key format required by the API:
        //   f_<fieldName>  -> exact match (or numeric comparison in server code)
        query.set(`f_${fieldName}`, value);
      }

      const res = await fetch(`/api/crud/${moduleKey}?${query.toString()}`);
      const payload = await fetchApiJson(res, apiUserMessage("loadList"));

      setData(Array.isArray(payload?.data) ? payload.data : []);
      setMeta(
        payload?.meta || { page: 1, limit, total: 0, totalPages: 1, sortBy: "id", sortDir: "desc" }
      );
    } catch (e) {
      showToast("error", formatUserFacingError(e, { fallback: apiUserMessage("loadList") }));
    } finally {
      setBusy(false);
    }
  };

  /** After a successful save: remain in entry mode with a fresh form; optionally refresh the grid data for View. */
  async function resetEntryAfterSave(options = {}) {
    const { reloadList = true, toastMessage, clearViewFilters = false, showSuccessToast = true } = options;
    setViewMode(false);
    setEditingRow(null);
    setFormKey((k) => k + 1);
    setSelectedId(null);
    if (clearViewFilters) {
      setViewColumnFilterInput({});
      setViewColumnFilters({});
    }
    if (showSuccessToast) {
      showToast(
        "success",
        toastMessage ?? `${config.label || moduleKey}: saved successfully.`
      );
    }
    if (reloadList) {
      await loadRecords();
    }
  }

  useEffect(() => {
    if (!isActive) return;
    if (!config) return;
    const filtersKey = JSON.stringify(viewColumnFilters || {});
    const fetchKey = `${moduleKey}|${String(page)}|${String(limit)}|${String(viewMode)}|${filtersKey}`;
    // Avoid duplicate list fetches when React re-renders with the same query key.
    if (recordsFetchKeyRef.current === fetchKey) return;
    recordsFetchKeyRef.current = fetchKey;
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, page, limit, viewMode, viewColumnFilters]);

  /**
   * Commit staged inputs to server filters (resets to page 1). Text filters apply on Enter; selects on change.
   * Uses a functional merge so `viewColumnFilterInput` is never stale when combining several columns.
   */
  function commitColumnFilters(mergeFn) {
    setViewColumnFilterInput((prev) => {
      const merged = typeof mergeFn === "function" ? mergeFn(prev) : mergeFn;
      return merged;
    });
    setViewColumnFilters((prev) => {
      const merged = typeof mergeFn === "function" ? mergeFn(prev) : mergeFn;
      return merged;
    });
    setPage(1);
    setSelectedId(null);
  }

  const hasAnyColumnFilter = useMemo(() => {
    const values = Object.values(viewColumnFilterInput || {});
    // Used to conditionally render "Clear column filters" only when something is actually entered.
    return values.some((v) => String(v ?? "").trim() !== "");
  }, [viewColumnFilterInput]);

  useEffect(() => {
    if (!isActive) return;
    const fetchKey = `${moduleKey}|permissions`;
    if (permissionsFetchKeyRef.current === fetchKey) return;
    permissionsFetchKeyRef.current = fetchKey;
    let cancelled = false;

    async function loadPermissions() {
      // Reads RBAC permissions from the server for this module key.
      // This determines whether Edit/Delete buttons should be visible.
      try {
        const res = await fetch(`/api/permissions/${moduleKey}`);
        const payload = await fetchApiJson(res, apiUserMessage("loadPermissions"));
        if (!cancelled && payload) {
          setPermissions({
            canView: Boolean(payload.canView),
            canCreate: Boolean(payload.canCreate),
            canEdit: Boolean(payload.canEdit),
            canDelete: Boolean(payload.canDelete),
            role: payload.role != null ? Number(payload.role) : null,
            unit:
              payload.unit != null && String(payload.unit).trim() !== ""
                ? payload.unit
                : null
          });
        }
      } catch (e) {
        if (!cancelled) {
          showToast("error", formatUserFacingError(e, { fallback: apiUserMessage("loadPermissions") }));
        }
      }
    }

    loadPermissions();
    return () => {
      cancelled = true;
      // React Strict Mode (dev): remount must be allowed to fetch again; ref was set before fetch completed.
      permissionsFetchKeyRef.current = "";
    };
  }, [isActive, moduleKey]);

  function handleNew() {
    if (busy) return;
    // "Clear Screen" resets this module back to a fresh entry form.
    setEditingRow(null);
    caseSnapshot.reset();
    invoicesReceivedClient.resetSnapshot();
    setFormKey((k) => k + 1);
    setSelectedId(null);
    setViewColumnFilterInput({});
    setViewColumnFilters({});
    setViewMode(false);
    setToast(null);
  }

  function handleViewOnly() {
    if (busy) return;
    // One-way switch: never toggle back to entry via View.
    if (config?.readOnly) return;
    setEditingRow(null);
    setFormKey((k) => k + 1);
    setSelectedId(null);
    setViewColumnFilterInput({});
    setViewColumnFilters({});
    setViewMode(true);
    setToast(null);
  }

  async function handleEditSelected() {
    if (busy) return;
    if (!selectedId) return;
    const row = data.find((r) => String(r.id) === String(selectedId));
    if (!row) return;

    if (isNciModule && permissions.canView && row._canEdit === false && nciViewRecordModal.enabled) {
      await nciViewRecordModal.openViewRecord(Number(selectedId));
      return;
    }

    if (!permissions.canEdit) return;
    if (row._canEdit === false && !isNciModule) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/crud/${moduleKey}/${selectedId}`);
      const payload = await fetchApiJson(res, apiUserMessage("loadRecord"));

      const parent = payload?.data;
      if (!parent) throw new Error("Invalid response");

      setEditingRow(parent);
      if (config?.childTables?.length) {
        setChildRowsByKey(childRowsStateFromApi(config.childTables, payload.childTableRows));
      }
      setSelectedId(null);
      setViewMode(false);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("loadRecord") }));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedId) return;
    if (!permissions.canDelete) return;
    if (busy) return;
    const row = data.find((r) => String(r.id) === String(selectedId));
    if (!row || row._canDelete === false) return;
    // Confirm and then delete the selected row by its `id`.
    const ok = window.confirm("Delete selected record?");
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/crud/${moduleKey}/${selectedId}`, { method: "DELETE" });
      await fetchApiJson(res, apiUserMessage("deleteRecord"));

      setSelectedId(null);
      await loadRecords();
      setViewMode(true);
      showToast("success", "Record deleted successfully.");
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("deleteRecord") }));
    } finally {
      setBusy(false);
    }
  }

  /** View mode: selected grid row. Entry mode: saved record being edited (`editingRow.id`). */
  const printCaseDetailsTargetId = getNciPrintTargetId({
    moduleKey,
    canView: permissions.canView,
    effectiveViewMode,
    selectedId,
    editingRowId: editingRow?.id ?? null
  });

  /** Public Notice: print from view grid (selected row) or while editing a saved row. */
  const printPublicNoticeTargetId = getPublicNoticePrintTargetId({
    moduleKey,
    canView: permissions.canView,
    effectiveViewMode,
    selectedId,
    editingRowId: editingRow?.id ?? null
  });

  const printRecoveryInvoiceTargetId = getRecoveryInvoicePrintTargetId({
    moduleKey,
    canView: permissions.canView,
    effectiveViewMode,
    selectedId,
    editingRowId: editingRow?.id ?? null
  });

  const printSarfaesiInvoiceTargetId = getSarfaesiInvoicePrintTargetId({
    moduleKey,
    canView: permissions.canView,
    effectiveViewMode,
    selectedId,
    editingRowId: editingRow?.id ?? null
  });

  const printVehicleInvoiceTargetId = getVehicleInvoicePrintTargetId({
    moduleKey,
    canView: permissions.canView,
    effectiveViewMode,
    selectedId,
    editingRowId: editingRow?.id ?? null
  });

  const printReturnCaseTargetId = getReturnCasePrintTargetId({
    moduleKey,
    canView: permissions.canView,
    effectiveViewMode,
    selectedId,
    editingRowId: editingRow?.id ?? null
  });

  async function handlePrintCaseDetails() {
    if (busy) return;
    if (!isNciModule || !permissions.canView) return;
    const id = printCaseDetailsTargetId;
    const rowForName = effectiveViewMode ? selectedRow : editingRow;
    const caseNoHint = rowValueForField(rowForName || {}, "caseNo");
    setBusy(true);
    try {
      await downloadNciCaseDetailsPdf(id, caseNoHint);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
    } finally {
      setBusy(false);
    }
  }

  // Shared click handler used by both view-grid and edit-mode Branch Copy buttons.
  async function handlePrintBranchCopy() {
    if (busy) return;
    if (!isNciModule || !permissions.canView) return;
    const id = effectiveViewMode ? selectedId : editingRow?.id ?? null;
    if (id == null) return;
    const rowForName = effectiveViewMode ? selectedRow : editingRow;
    const caseNoHint = String(rowValueForField(rowForName || {}, "caseNo") ?? "").trim();
    setBusy(true);
    try {
      await downloadNciBranchCopyPdf(id, caseNoHint || null);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintPublicNoticeFromToolbar() {
    if (busy) return;
    if (!isPublicNotice || !permissions.canView) return;
    const id = printPublicNoticeTargetId;
    if (id == null) return;
    const rowForName = effectiveViewMode ? selectedRow : editingRow;
    const refHint = publicNoticeRefHintFromRow(rowForName);
    setBusy(true);
    try {
      await downloadPublicNoticePdf(id, refHint || null);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintRecoveryInvoiceFromToolbar() {
    if (busy) return;
    if (!isRecoveryInvoice || !permissions.canView) return;
    const id = printRecoveryInvoiceTargetId;
    if (id == null) return;
    const rowForName = effectiveViewMode ? selectedRow : editingRow;
    const refHint = recoveryInvoiceRefHintFromRow(rowForName);
    setBusy(true);
    try {
      await downloadRecoveryInvoicePdf(id, refHint || null);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintSarfaesiInvoiceFromToolbar() {
    if (busy) return;
    if (!isSarfaesiInvoice || !permissions.canView) return;
    const id = printSarfaesiInvoiceTargetId;
    if (id == null) return;
    const rowForName = effectiveViewMode ? selectedRow : editingRow;
    const refHint = sarfaesiInvoiceRefHintFromRow(rowForName);
    setBusy(true);
    try {
      await downloadSarfaesiInvoicePdf(id, refHint || null);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintVehicleInvoiceFromToolbar() {
    if (busy) return;
    if (!isVehicleInvoice || !permissions.canView) return;
    const id = printVehicleInvoiceTargetId;
    if (id == null) return;
    const rowForName = effectiveViewMode ? selectedRow : editingRow;
    const refHint = vehicleInvoiceRefHintFromRow(rowForName);
    setBusy(true);
    try {
      await downloadVehicleInvoicePdf(id, refHint || null);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintReturnCaseFromToolbar() {
    // Return Case: download RETURN_<refNo>.pdf (same pattern as invoice Print).
    if (busy) return;
    if (!isReturnCase || !permissions.canView) return;
    const id = printReturnCaseTargetId;
    if (id == null) return;
    const rowForName = effectiveViewMode ? selectedRow : editingRow;
    const refHint = returnCaseRefHintFromRow(rowForName);
    setBusy(true);
    try {
      await downloadReturnCasePdf(id, refHint || null);
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
    } finally {
      setBusy(false);
    }
  }

  async function handlePostCreateAckPrintPdf(recordId, valueText) {
    if (busy) return;
    if (!permissions.canView) return;

    // Public Notice only: dedicated PDF route after save acknowledgement.
    if (isPublicNotice) {
      setPostCreateAckOpen(null);
      setBusy(true);
      try {
        await downloadPublicNoticePdf(recordId, valueText);
      } catch (err) {
        showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
      } finally {
        setBusy(false);
      }
      await resetEntryAfterSave({ clearViewFilters: true, showSuccessToast: false });
      return;
    }

    if (isRecoveryInvoice) {
      setPostCreateAckOpen(null);
      setBusy(true);
      try {
        await downloadRecoveryInvoicePdf(recordId, valueText);
      } catch (err) {
        showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
      } finally {
        setBusy(false);
      }
      await resetEntryAfterSave({ clearViewFilters: true, showSuccessToast: false });
      return;
    }

    if (isSarfaesiInvoice) {
      setPostCreateAckOpen(null);
      setBusy(true);
      try {
        await downloadSarfaesiInvoicePdf(recordId, valueText);
      } catch (err) {
        showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
      } finally {
        setBusy(false);
      }
      await resetEntryAfterSave({ clearViewFilters: true, showSuccessToast: false });
      return;
    }

    if (isVehicleInvoice) {
      setPostCreateAckOpen(null);
      setBusy(true);
      try {
        await downloadVehicleInvoicePdf(recordId, valueText);
      } catch (err) {
        showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
      } finally {
        setBusy(false);
      }
      await resetEntryAfterSave({ clearViewFilters: true, showSuccessToast: false });
      return;
    }

    if (isReturnCase) {
      // Post-save Print → download Return Case letter PDF, then return to list.
      setPostCreateAckOpen(null);
      setBusy(true);
      try {
        await downloadReturnCasePdf(recordId, valueText);
      } catch (err) {
        showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
      } finally {
        setBusy(false);
      }
      await resetEntryAfterSave({ clearViewFilters: true, showSuccessToast: false });
      return;
    }

    if (!isNciModule) return;
    const printMode = String(postCreateAckOpen?.printMode || "branchCopy").trim();
    // UX: once user chooses print from acknowledgement, close the modal immediately.
    setPostCreateAckOpen(null);

    if (printMode === "caseDetails") {
      setBusy(true);
      try {
        await downloadNciCaseDetailsPdf(recordId, valueText || null);
      } catch (err) {
        showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
      } finally {
        setBusy(false);
      }
    } else {
      let caseNoForFile = String(valueText ?? "").trim();
      // Prefer saved case number for branch-copy filename if modal value is unavailable.
      if (!caseNoForFile) {
        try {
          caseNoForFile = await fetchSavedNciCaseNo(recordId);
        } catch {
          // Non-blocking: download still proceeds with fallback naming inside downloader.
        }
      }
      setBusy(true);
      try {
        await downloadNciBranchCopyPdf(recordId, caseNoForFile || null);
      } catch (err) {
        showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("downloadPdf") }));
      } finally {
        setBusy(false);
      }
    }

    await resetEntryAfterSave({ clearViewFilters: true, showSuccessToast: false });
  }

  function handlePostCreateAckContinue() {
    const ack = postCreateAckOpen;
    setPostCreateAckOpen(null);
    if (!ack) return;
    void resetEntryAfterSave({ clearViewFilters: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!config || busy) return;
    if (!canSave) return;

    if (config.childTables?.length) {
      const childErr = validateChildTableRows(config, childRowsByKey);
      if (childErr) {
        showToast("error", childErr);
        return;
      }
    }

    const form = Object.fromEntries(new FormData(e.target));
    let body = { ...form };
    if (config.childTables?.length) {
      body.childTableRows = stripChildRowsForApi(config.childTables, childRowsByKey);
      body = applyReturnCaseSubmitBody(moduleKey, body);
    }
    body = invoicesReceivedClient.mergeSubmitBody(body);
    body = recoveryInvoiceClient.mergeSubmitBody(body);
    body = sarfaesiInvoiceClient.mergeSubmitBody(body);
    body = vehicleInvoiceClient.mergeSubmitBody(body);

    if (isRecoveryInvoiceModule(moduleKey)) {
      const recoveryErr = validateRecoveryInvoiceClientSubmit(body);
      if (recoveryErr) {
        showToast("error", recoveryErr);
        return;
      }
    }
    if (isSarfaesiInvoiceModule(moduleKey)) {
      const sarfaesiErr = validateSarfaesiInvoiceClientSubmit(body);
      if (sarfaesiErr) {
        showToast("error", sarfaesiErr);
        return;
      }
    }
    if (isVehicleInvoiceModule(moduleKey)) {
      const vehicleErr = validateVehicleInvoiceClientSubmit(body);
      if (vehicleErr) {
        showToast("error", vehicleErr);
        return;
      }
    }

    if (isNewCaseInwardModule(moduleKey)) {
      const err = validateNciSubmitBody(body, editingRow);
      if (err) {
        showToast("error", err);
        return;
      }
    }

    setBusy(true);
    try {
      // Create when adding a new record, update when editing an existing one.
      const method = editingRow ? "PUT" : "POST";
      const url = editingRow ? `/api/crud/${moduleKey}/${editingRow.id}` : `/api/crud/${moduleKey}`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const payload = await fetchApiJson(
        res,
        apiUserMessage("saveRecord")
      );

      const ackCfg = config.postCreateAck;
      const pAck = payload?.postCreateAck;
      const pAckValid =
        ackCfg &&
        pAck?.value != null &&
        String(pAck.value).trim() !== "" &&
        (!pAck.field || !ackCfg.field || pAck.field === ackCfg.field);
      // New Case Inward: acknowledgement only on create. Public Notice: create and update.
      const wantsAck =
        Boolean(pAckValid) &&
        (!editingRow ||
          shouldShowPublicNoticeAckOnEdit(moduleKey, editingRow) ||
          shouldShowRecoveryInvoiceAckOnEdit(moduleKey, editingRow) ||
          shouldShowSarfaesiInvoiceAckOnEdit(moduleKey, editingRow) ||
          shouldShowVehicleInvoiceAckOnEdit(moduleKey, editingRow) ||
          shouldShowReturnCaseAckOnEdit(moduleKey, editingRow));

      if (wantsAck) {
        setPostCreateAckOpen({
          id: Number(payload.id ?? editingRow?.id),
          value: String(pAck.value).trim(),
          valueLabel: ackCfg.valueLabel,
          title: ackCfg.title,
          hint: ackCfg.hint,
          suppressValue: false,
          showPrintPdf: ackCfg.showPrintPdf === true,
          showCopyButton: ackCfg.showCopyButton !== false,
          printButtonLabel: ackCfg.printButtonLabel,
          printMode: isPublicNotice ? getPublicNoticeAckPrintMode() : undefined
        });
        return;
      }

      const nciFinalAck = await fetchNciFinalStatusAckPayload({
        moduleKey,
        editingRow,
        payload,
        caseStatusField: nciCaseStatusField
      });
      if (nciFinalAck) {
        setPostCreateAckOpen(nciFinalAck);
        return;
      }

      await resetEntryAfterSave({ clearViewFilters: false });
    } catch (err) {
      showToast("error", formatUserFacingError(err, { fallback: apiUserMessage("saveRecord") }));
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return (
      <div className="card">
        <h1>{moduleKey}</h1>
        <p>Module not configured. Add it in config/modules.js.</p>
      </div>
    );
  }

  const entryActionsBar = (
    <div className={`master-view-actions${isNciModule ? " master-nci-entry-actions" : ""}`}>
      <div className="master-view-actions-left">
        {isNciModule && permissions.canView && printCaseDetailsTargetId != null ? (
          <button
            type="button"
            onClick={handlePrintCaseDetails}
            title="Download PDF with parent and line-item details"
            className="master-btn master-btn-outline"
            disabled={busy}
          >
            <PrintCaseDetailsIcon />
            {getNciCaseDetailsPrintButtonText()}
          </button>
        ) : null}
        {isNciModule && permissions.canView && printCaseDetailsTargetId != null ? (
          <button
            type="button"
            onClick={handlePrintBranchCopy}
            title="Download Branch Copy PDF"
            className="master-btn master-btn-outline"
            disabled={busy}
          >
            <PrintCaseDetailsIcon />
            {getNciBranchCopyPrintButtonText()}
          </button>
        ) : null}
        {isPublicNotice && permissions.canView && printPublicNoticeTargetId != null ? (
          <button
            type="button"
            onClick={handlePrintPublicNoticeFromToolbar}
            title="Download Public Notice PDF"
            className="master-btn master-btn-outline"
            disabled={busy}
          >
            <PrintCaseDetailsIcon />
            {getPublicNoticePrintButtonText()}
          </button>
        ) : null}
        {isRecoveryInvoice && permissions.canView && printRecoveryInvoiceTargetId != null ? (
          <button
            type="button"
            onClick={handlePrintRecoveryInvoiceFromToolbar}
            title="Download Recovery Invoice PDF"
            className="master-btn master-btn-outline"
            disabled={busy}
          >
            <PrintCaseDetailsIcon />
            {getRecoveryInvoicePrintButtonText()}
          </button>
        ) : null}
        {isSarfaesiInvoice && permissions.canView && printSarfaesiInvoiceTargetId != null ? (
          <button
            type="button"
            onClick={handlePrintSarfaesiInvoiceFromToolbar}
            title="Download SARFAESI Invoice PDF"
            className="master-btn master-btn-outline"
            disabled={busy}
          >
            <PrintCaseDetailsIcon />
            {getSarfaesiInvoicePrintButtonText()}
          </button>
        ) : null}
        {isVehicleInvoice && permissions.canView && printVehicleInvoiceTargetId != null ? (
          <button
            type="button"
            onClick={handlePrintVehicleInvoiceFromToolbar}
            title="Download Vehicle Invoice PDF"
            className="master-btn master-btn-outline"
            disabled={busy}
          >
            <PrintCaseDetailsIcon />
            {getVehicleInvoicePrintButtonText()}
          </button>
        ) : null}
        {isReturnCase && permissions.canView && printReturnCaseTargetId != null ? (
          <button
            type="button"
            onClick={handlePrintReturnCaseFromToolbar}
            title="Download Return Case PDF"
            className="master-btn master-btn-outline"
            disabled={busy}
          >
            <PrintCaseDetailsIcon />
            {getReturnCasePrintButtonText()}
          </button>
        ) : null}
      </div>
      <div className="master-view-actions-right">
        {canSave ? (
          <button form={formId} type="submit" className="master-btn master-btn-primary" disabled={busy}>
            <SaveIcon />
            Save
          </button>
        ) : null}
        {!config.readOnly && permissions.canView ? (
          <button
            type="button"
            onClick={handleViewOnly}
            disabled={busy}
            title="View saved data"
            className="master-btn master-btn-info"
          >
            <EyeIcon />
            View
          </button>
        ) : null}
        <button type="button" onClick={handleNew} title="Clear screen" className="master-btn master-btn-warning" disabled={busy}>
          <ClearIcon />
          Clear Screen
        </button>
      </div>
    </div>
  );

  return (
    <div className="master-module-page">
      <PostCreateAckModal
        open={postCreateAckOpen != null}
        value={postCreateAckOpen?.value}
        valueLabel={postCreateAckOpen?.valueLabel}
        title={postCreateAckOpen?.title}
        hint={postCreateAckOpen?.hint}
        suppressValue={postCreateAckOpen?.suppressValue === true}
        showCopyButton={postCreateAckOpen?.showCopyButton !== false}
        // Print slot: wired per module in handlePostCreateAckPrintPdf (NCI vs Public Notice).
        showPrintPdf={
          isNciModule ||
          isPublicNotice ||
          isRecoveryInvoice ||
          isSarfaesiInvoice ||
          isVehicleInvoice ||
          isReturnCase
            ? postCreateAckOpen?.showPrintPdf
            : false
        }
        printButtonLabel={
          isNciModule
            ? getNciAckPrintLabel(postCreateAckOpen?.printButtonLabel)
            : isPublicNotice
              ? getPublicNoticeAckPrintLabel(postCreateAckOpen?.printButtonLabel)
              : isRecoveryInvoice
                ? getRecoveryInvoiceAckPrintLabel(postCreateAckOpen?.printButtonLabel)
                : isSarfaesiInvoice
                  ? getSarfaesiInvoiceAckPrintLabel(postCreateAckOpen?.printButtonLabel)
                  : isVehicleInvoice
                    ? getVehicleInvoiceAckPrintLabel(postCreateAckOpen?.printButtonLabel)
                    : isReturnCase
                      ? getReturnCaseAckPrintLabel(postCreateAckOpen?.printButtonLabel)
                      : "Print"
        }
        recordId={postCreateAckOpen?.id}
        onContinue={handlePostCreateAckContinue}
        onPrintPdf={handlePostCreateAckPrintPdf}
      />
      <LoadingOverlay busy={busy} />

      <div className="master-module-header">
        <h1 className="module-page-title">{title}</h1>
        <div className="master-module-header-actions">
          <MasterActionsMenu
            formId={formId}
            busy={busy}
            readOnly={config.readOnly}
            entryMode={!effectiveViewMode}
            editingRow={Boolean(editingRow)}
            canCreate={permissions.canCreate}
            canEdit={permissions.canEdit}
            canSaveThisRow={canSaveThisRow}
            canView={permissions.canView}
            onView={handleViewOnly}
            onClear={handleNew}
          />
        </div>
      </div>

      <ToastNotice toast={toast} onClose={() => setToast(null)} />
      {auditCompareDialog ? (
        <div
          className="audit-json-modal-backdrop"
          role="presentation"
          onClick={() => setAuditCompareDialog(null)}
        >
          <div
            className="audit-json-modal"
            role="dialog"
            aria-modal="true"
            aria-label={auditCompareDialog.title || "Audit compare"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="audit-json-modal-header">
              <div style={{ minWidth: 0 }}>
                <h3 className="audit-json-modal-title">{auditCompareDialog.title}</h3>
                {auditCompareDialog.subtitle ? (
                  <p className="subtle" style={{ margin: "4px 0 0", fontSize: "12px" }}>
                    {auditCompareDialog.subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="audit-json-modal-close"
                onClick={() => setAuditCompareDialog(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {buildAuditCompareRows(
              auditCompareDialog.oldRaw,
              auditCompareDialog.newRaw,
              auditCompareDialog.targetModule,
              auditCompareDialog.contextRow,
              auditCompareDialog.enrichedOld,
              auditCompareDialog.enrichedNew
            ).length ? (
              <div className="audit-compare-table-wrap">
                <table className="audit-compare-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Old Data</th>
                      <th>New Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildAuditCompareRows(
                      auditCompareDialog.oldRaw,
                      auditCompareDialog.newRaw,
                      auditCompareDialog.targetModule,
                      auditCompareDialog.contextRow,
                      auditCompareDialog.enrichedOld,
                      auditCompareDialog.enrichedNew
                    ).map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>{row.oldVal || "—"}</td>
                        <td>{row.newVal || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="audit-json-modal-split">
                <div>
                  <h4>Old Data</h4>
                  <pre className="audit-json-modal-pre">
                    {prettyAuditJsonText(auditCompareDialog.oldRaw) || "—"}
                  </pre>
                </div>
                <div>
                  <h4>New Data</h4>
                  <pre className="audit-json-modal-pre">
                    {prettyAuditJsonText(auditCompareDialog.newRaw) || "—"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <CaseSnapshotModal
        open={caseSnapshot.enabled && caseSnapshot.modalOpen}
        onClose={() => caseSnapshot.setModalOpen(false)}
        selectedCaseId={caseSnapshot.selectedCaseId}
        loading={caseSnapshot.loading}
        preview={caseSnapshot.preview}
      />

      <InvoiceSnapshotModal
        open={isInvoicesReceived && invoicesReceivedClient.snapshotModalOpen}
        onClose={() => invoicesReceivedClient.setSnapshotModalOpen(false)}
        loading={invoicesReceivedClient.snapshotLoading}
        preview={invoicesReceivedClient.snapshotPreview}
        hasSelection={invoicesReceivedClient.snapshotHasSelection}
      />

      {nciViewRecordModal.viewRecordModal}

      {!effectiveViewMode ? (
        <div
          className={
            isNciModule ? "master-entry-shell-nci table-section" : "card table-section master-entry-shell"
          }
        >
          {/* Entry mode: same shell as view list — footer actions share master-view-actions + top rule */}
          {/* Key suffixes: remount DynamicForm when session-derived unit changes (role 2 new entry). Tags: -aai- assets, -cdw- cash DW, -aev- expense voucher, -ala- loan AC. */}
          <DynamicForm
            key={`${formKey}-${editingRow ? `edit-${editingRow.id}` : "new"}${
              accountsAssetsDynamicFormKeySuffix ? `-aai-${accountsAssetsDynamicFormKeySuffix}` : ""
            }${accountsCashDwDynamicFormKeySuffix ? `-cdw-${accountsCashDwDynamicFormKeySuffix}` : ""}${
              accountsExpenseVoucherDynamicFormKeySuffix ? `-aev-${accountsExpenseVoucherDynamicFormKeySuffix}` : ""
            }${accountsLoanAcDynamicFormKeySuffix ? `-ala-${accountsLoanAcDynamicFormKeySuffix}` : ""}`}
            moduleKey={moduleKey}
            config={entryModeConfig}
            onSubmit={handleSubmit}
            initialValues={
              isReturnCase
                ? returnCaseEntryFormInitialValues
                : isRecoveryInvoice
                  ? recoveryInvoiceEntryFormInitialValues
                  : isSarfaesiInvoice
                    ? sarfaesiInvoiceEntryFormInitialValues
                    : isVehicleInvoice
                      ? vehicleInvoiceEntryFormInitialValues
                      : entryFormInitialValues
            }
            readOnlyFields={entryFormReadOnlyFields}
            fieldUiOverrides={entryFieldUiOverrides}
            lookupOptionsByField={isNciModule ? nciClient.lookupOptionsByField : null}
            disableLookupRemoteByField={isNciModule ? nciDisableLookupRemoteByField : null}
            onFieldValueChange={handleEntryFieldValueChange}
            submitLabel="Save"
            hideButtons
            formId={formId}
            className="master-entry-form"
            formGridClassName="form-grid form-grid-master"
            formRootStyle={{ marginBottom: 0 }}
            nciSplitEntryCards={isNciModule}
            entryFooterContent={
              isNciModule && showEntryChildTables ? (
                <ModuleChildTablesPanel
                  childTables={config.childTables}
                  value={childRowsByKey}
                  onChange={setChildRowsByKey}
                  childFieldUiOverrides={childFieldUiOverrides}
                  disabled={busy}
                  onNotify={(kind, message) => showToast(kind, message)}
                />
              ) : null
            }
            entryActionsBar={isNciModule ? entryActionsBar : null}
          />
          {caseSnapshot.enabled ? (
            <div style={{ marginTop: "12px", marginBottom: "4px" }}>
              <button
                type="button"
                className="master-btn master-btn-outline"
                disabled={!caseSnapshot.selectedCaseId}
                title={
                  caseSnapshot.selectedCaseId
                    ? "View a read-only summary of the selected case"
                    : "Select Case No first"
                }
                onClick={() => caseSnapshot.setModalOpen(true)}
              >
                View Selected Case Snapshot
              </button>
            </div>
          ) : null}
          {isInvoicesReceived ? (
            <div style={{ marginTop: "12px", marginBottom: "4px" }}>
              <button
                type="button"
                className="master-btn master-btn-outline"
                disabled={!invoicesReceivedClient.snapshotHasSelection}
                title={
                  invoicesReceivedClient.snapshotHasSelection
                    ? "View a read-only summary of the selected invoice"
                    : "Select an invoice first"
                }
                onClick={() => invoicesReceivedClient.setSnapshotModalOpen(true)}
              >
                Invoice Snapshot
              </button>
            </div>
          ) : null}
          {showEntryChildTables && !isNciModule ? (
            <ModuleChildTablesPanel
              childTables={config.childTables}
              value={childRowsByKey}
              onChange={setChildRowsByKey}
              childFieldUiOverrides={childFieldUiOverrides}
              disabled={busy}
              onNotify={(kind, message) => showToast(kind, message)}
            />
          ) : null}
          {(isRecoveryInvoiceModule(moduleKey) ||
            isSarfaesiInvoiceModule(moduleKey) ||
            isVehicleInvoiceModule(moduleKey)) &&
          showEntryChildTables ? (
            <div className="recovery-invoice-grand-total-bar" role="status" aria-live="polite">
              <span className="recovery-invoice-grand-total-label">Grand Total</span>
              <span className="recovery-invoice-grand-total-value">
                {isRecoveryInvoiceModule(moduleKey)
                  ? recoveryInvoiceClient.grandTotalDisplay
                  : isSarfaesiInvoiceModule(moduleKey)
                    ? sarfaesiInvoiceClient.grandTotalDisplay
                    : vehicleInvoiceClient.grandTotalDisplay}
              </span>
            </div>
          ) : null}
          {!isNciModule ? entryActionsBar : null}
        </div>
      ) : (
        // View mode: show a table with per-column filters + checkbox selection.
        <div className="card table-section">
          <p className="table-scroll-hint" role="note">
            Swipe or scroll sideways to see all columns.
          </p>
          {nciStatusDotEnabled ? (
            <div className="master-status-legend" role="note" aria-label="Case status legend">
              <span className="master-status-legend-item">
                <span className="master-status-dot master-status-dot--ongoing" aria-hidden />
                Ongoing Case
              </span>
              <span className="master-status-legend-item">
                <span className="master-status-dot master-status-dot--final" aria-hidden />
                Completed Case
              </span>
              <span className="master-status-legend-item">
                <span className="master-status-dot master-status-dot--returned" aria-hidden />
                Returned Case
              </span>
            </div>
          ) : null}
          <div className="table-wrap table-wrap-scroll-y master-orders-table-wrap">
            <table
              className={`data-table data-table-compact master-orders-table${
                isAuditLogs ? " master-orders-table--audit-logs" : ""
              }`}
            >
              <thead>
                <tr>
                  {!auditLogsSimpleView ? (
                    <th className="master-select-col" scope="col">
                      ✔️
                    </th>
                  ) : null}
                  {nciStatusDotEnabled ? <th className="master-status-dot-col">Status</th> : null}
                  {viewFieldConfigs.map((f) => (
                    <th
                      key={f.name}
                      className={isAuditLogs ? getAuditLogsGridColumnClass(f.name) || undefined : undefined}
                    >
                      {f.label || f.name}
                    </th>
                  ))}
                  {nciViewPeekEnabled ? (
                    <th
                      className="master-nci-peek-grid-head"
                      scope="col"
                      title={NCI_VIEW_GRID_PEEK_COLUMN_HEADER}
                      style={{
                        width: "1.75rem",
                        maxWidth: "2.75rem",
                        padding: "2px 1px",
                        textAlign: "center",
                        fontSize: "9px",
                        lineHeight: 1.1,
                        verticalAlign: "middle",
                        fontWeight: 600
                      }}
                    >
                      {NCI_VIEW_GRID_PEEK_COLUMN_HEADER}
                    </th>
                  ) : null}
                  {auditLogsCompareEnabled ? <th className="audit-compare-col">Compare</th> : null}
                </tr>
                <tr>
                  {!auditLogsSimpleView ? (
                    <th className="master-filter-th" aria-hidden>
                      {/* selection column has no filter */}
                    </th>
                  ) : null}
                  {nciStatusDotEnabled ? <th className="master-filter-th" aria-hidden /> : null}
                  {viewFieldConfigs.map((f) => {
                    // Per-column filter input.
                    // Values are sent to the server as `f_<fieldName>` and applied server-side.
                    const value = viewColumnFilterInput?.[f.name] ?? "";
                    const onChangeValue = (next) =>
                      setViewColumnFilterInput((prev) => ({ ...prev, [f.name]: next }));

                    if (f.type === "select" && Array.isArray(f.options)) {
                      return (
                        <th
                          key={f.name}
                          className={[
                            "master-filter-th",
                            isAuditLogs ? getAuditLogsGridColumnClass(f.name) : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <select
                            className="master-col-filter-input"
                            value={value}
                            onChange={(e) => {
                              const next = e.target.value;
                              commitColumnFilters((prev) => ({ ...prev, [f.name]: next }));
                            }}
                            aria-label={`Filter ${f.label}`}
                          >
                            <option value="">All</option>
                            {f.options.map((opt) => (
                              <option key={String(opt.value)} value={String(opt.value)}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </th>
                      );
                    }

                    const inputType = "text";
                    const filterPlaceholder =
                      f.type === "date" ? "dd-mm-yyyy" : f.type === "number" ? "Amount (commas OK)" : "";
                    const filterTitle =
                      f.type === "date"
                        ? "Type dd-mm-yyyy or yyyy-mm-dd, then Enter"
                        : f.type === "number"
                          ? "Type digits (commas OK); matches amounts containing those digits, then Enter"
                          : "Press Enter to apply filter";

                    return (
                      <th
                        key={f.name}
                        className={[
                          "master-filter-th",
                          isAuditLogs ? getAuditLogsGridColumnClass(f.name) : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <input
                          className="master-col-filter-input"
                          value={value}
                          type={inputType}
                          inputMode={f.type === "number" ? "decimal" : undefined}
                          onChange={(e) => onChangeValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            // Read value here — React may null `e.currentTarget` before the setState updater runs.
                            const nextVal = e.currentTarget.value;
                            commitColumnFilters((prev) => ({
                              ...prev,
                              [f.name]: nextVal
                            }));
                          }}
                          placeholder={filterPlaceholder}
                          title={filterTitle}
                          aria-label={`Filter ${f.label}`}
                        />
                      </th>
                    );
                  })}
                  {nciViewPeekEnabled ? (
                    <th className="master-filter-th master-nci-peek-filter" aria-hidden style={{ width: "1.75rem", maxWidth: "2.75rem", padding: 0 }} />
                  ) : null}
                  {auditLogsCompareEnabled ? <th className="master-filter-th" aria-hidden /> : null}
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const isChecked = selectedId != null && String(r.id) === String(selectedId);
                  // Dot color comes from current case status label (lookup label preferred).
                  const nciDotTone = nciCaseStatusField != null ? getNciDotTone(r, nciCaseStatusField) : null;
                  const trClass = [isChecked && "master-row-selected"].filter(Boolean).join(" ");
                  return (
                    <tr key={r.id} className={trClass || undefined}>
                      {!auditLogsSimpleView ? (
                        <td className="master-select-col">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            // Only one row can be selected at a time; clicking again clears selection.
                            onChange={() => setSelectedId(isChecked ? null : r.id)}
                            aria-label={`Select ${moduleKey} ${r.id}`}
                          />
                        </td>
                      ) : null}
                      {nciStatusDotEnabled ? (
                        <td className="master-status-dot-col">
                          <span
                            className={`master-status-dot master-status-dot--${nciDotTone || "ongoing"}`}
                            title={
                              nciDotTone === "returned"
                                ? "Returned case"
                                : nciDotTone === "final"
                                  ? "Final stage case"
                                  : "Ongoing case"
                            }
                            aria-label={
                              nciDotTone === "returned"
                                ? "Returned case"
                                : nciDotTone === "final"
                                  ? "Final stage case"
                                  : "Ongoing case"
                            }
                          />
                        </td>
                      ) : null}
                      {viewFieldConfigs.map((f) => (
                        <td
                          key={f.name}
                          className={
                            isAuditLogs ? getAuditLogsGridColumnClass(f.name) || undefined : undefined
                          }
                        >
                          {/* rowValueForField: MySQL may return column names in different casing than config. */}
                          {isAuditLogsJsonField(f.name) ? (
                            (() => {
                              const raw = rowValueForField(r, f.name);
                              const preview = auditJsonPreview(raw);
                              return preview ? (
                                <span className="audit-json-preview">{preview}</span>
                              ) : (
                                "—"
                              );
                            })()
                          ) : isAuditLogsCreatedAtField(f.name) ? (
                            (() => {
                              const raw = rowValueForField(r, f.name);
                              const d = raw ? new Date(raw) : null;
                              if (!d || Number.isNaN(d.getTime())) return raw ? String(raw) : "";
                              const dd = String(d.getDate()).padStart(2, "0");
                              const mm = String(d.getMonth() + 1).padStart(2, "0");
                              const yyyy = d.getFullYear();
                              const hh = String(d.getHours()).padStart(2, "0");
                              const min = String(d.getMinutes()).padStart(2, "0");
                              return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
                            })()
                          ) : isAuditLogs && isAuditLogsModuleColumn(f.name) ? (
                            formatAuditModuleLabel(rowValueForField(r, f.name))
                          ) : isAuditLogs && isAuditLogsRecordLabelColumn(f.name) ? (
                            (() => {
                              const text = String(rowValueForField(r, f.name) ?? "").trim();
                              return text ? (
                                <span className="audit-record-preview" title={text}>
                                  {text}
                                </span>
                              ) : (
                                "—"
                              );
                            })()
                          ) : f.type === "lookup" ? (
                            rowValueForField(r, getLookupRowLabelKey(f)) ??
                            rowValueForField(r, f.name) ??
                            ""
                          ) : (
                            formatViewCellValue(f, rowValueForField(r, f.name))
                          )}
                        </td>
                      ))}
                      {nciViewPeekEnabled ? (
                        <td
                          className="master-nci-peek-grid-cell"
                          style={{
                            width: "1.75rem",
                            maxWidth: "2.75rem",
                            padding: "2px 1px",
                            textAlign: "center",
                            verticalAlign: "middle",
                            margin: 0
                          }}
                        >
                          <NciViewRecordPeekButton
                            recordId={r.id}
                            disabled={busy}
                            onPeek={() => nciViewRecordModal.openViewRecord(Number(r.id))}
                          />
                        </td>
                      ) : null}
                      {auditLogsCompareEnabled ? (
                        <td className="audit-compare-col">
                          <button
                            type="button"
                            className="audit-json-open"
                            onClick={() => {
                              const targetModule = String(rowValueForField(r, "module") ?? "").trim();
                              const recordId = rowValueForField(r, "record_id");
                              const recordLabel = String(rowValueForField(r, "record_label") ?? "").trim();
                              const auditEntryId = rowValueForField(r, "id");
                              const action = rowValueForField(r, "action");
                              const createdAt = rowValueForField(r, "created_at");
                              setAuditCompareDialog({
                                targetModule,
                                recordId,
                                recordLabel,
                                auditEntryId,
                                action,
                                createdAt,
                                fetchFailed: false,
                                title: buildAuditCompareTitle({ targetModule, recordLabel, recordId }),
                                subtitle: buildAuditCompareSubtitle({
                                  auditEntryId,
                                  action,
                                  createdAt,
                                  fetchFailed: false,
                                  recordId
                                }),
                                contextRow: null,
                                enrichedOld: null,
                                enrichedNew: null,
                                oldRaw: rowValueForField(r, "old_data"),
                                newRaw: rowValueForField(r, "new_data")
                              });
                            }}
                          >
                            Compare
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={limit}
            onPageChange={(p) => {
              setPage(p);
              setSelectedId(null);
            }}
            onLimitChange={(n) => {
              setPage(1);
              setLimit(n);
              setSelectedId(null);
            }}
            leftExtra={
              hasAnyColumnFilter ? (
                // Clear column filters button placed next to the "Showing X–Y of Z" summary.
                <button
                  type="button"
                  className="master-btn master-btn-warning"
                  onClick={() => {
                    setViewColumnFilterInput({});
                    setViewColumnFilters({});
                    setSelectedId(null);
                    setPage(1);
                  }}
                  title="Clear column filters"
                >
                  <ClearIcon />
                  Clear
                </button>
              ) : null
            }
          />

          {!auditLogsSimpleView ? (
            <div className="master-view-actions">
              <div className="master-view-actions-left">
                {!config.readOnly && permissions.canCreate ? (
                  <button
                    type="button"
                    onClick={handleNew}
                    title="New record"
                    className="master-btn master-btn-warning"
                    disabled={busy}
                  >
                    <ClearIcon />
                    New Record
                  </button>
                ) : null}
                {canOpenSelectedRecord ? (
                  <button
                    type="button"
                    className="master-btn master-btn-primary"
                    onClick={handleEditSelected}
                    title={selectedRow?._canEdit === false ? "View Full Record" : "Edit Record"}
                    disabled={busy}
                  >
                    <EditIcon />
                    {selectedRow?._canEdit === false ? "View Record" : "Edit Record"}
                  </button>
                ) : null}
                {selectedId && permissions.canDelete && selectedRow?._canDelete !== false ? (
                  <button
                    type="button"
                    className="master-btn master-btn-danger"
                    onClick={handleDeleteSelected}
                    title="Delete Record"
                    disabled={busy}
                  >
                    <TrashIcon />
                    Delete Record
                  </button>
                ) : null}
                {printCaseDetailsTargetId != null ? (
                  <button
                    type="button"
                    onClick={handlePrintCaseDetails}
                    title="Download PDF with parent and line-item details"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    {getNciCaseDetailsPrintButtonText()}
                  </button>
                ) : null}
                {isNciModule &&
                effectiveViewMode &&
                selectedId != null &&
                permissions.canView ? (
                  <button
                    type="button"
                    onClick={handlePrintBranchCopy}
                    title="Download Branch Copy PDF"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    {getNciBranchCopyPrintButtonText()}
                  </button>
                ) : null}
                {isPublicNotice &&
                effectiveViewMode &&
                printPublicNoticeTargetId != null &&
                permissions.canView ? (
                  <button
                    type="button"
                    onClick={handlePrintPublicNoticeFromToolbar}
                    title="Download Public Notice PDF"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    {getPublicNoticePrintButtonText()}
                  </button>
                ) : null}
                {isRecoveryInvoice &&
                effectiveViewMode &&
                printRecoveryInvoiceTargetId != null &&
                permissions.canView ? (
                  <button
                    type="button"
                    onClick={handlePrintRecoveryInvoiceFromToolbar}
                    title="Download Recovery Invoice PDF"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    {getRecoveryInvoicePrintButtonText()}
                  </button>
                ) : null}
                {isSarfaesiInvoice &&
                effectiveViewMode &&
                printSarfaesiInvoiceTargetId != null &&
                permissions.canView ? (
                  <button
                    type="button"
                    onClick={handlePrintSarfaesiInvoiceFromToolbar}
                    title="Download SARFAESI Invoice PDF"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    {getSarfaesiInvoicePrintButtonText()}
                  </button>
                ) : null}
                {isVehicleInvoice &&
                effectiveViewMode &&
                printVehicleInvoiceTargetId != null &&
                permissions.canView ? (
                  <button
                    type="button"
                    onClick={handlePrintVehicleInvoiceFromToolbar}
                    title="Download Vehicle Invoice PDF"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    {getVehicleInvoicePrintButtonText()}
                  </button>
                ) : null}
                {isReturnCase &&
                effectiveViewMode &&
                printReturnCaseTargetId != null &&
                permissions.canView ? (
                  <button
                    type="button"
                    onClick={handlePrintReturnCaseFromToolbar}
                    title="Download Return Case PDF"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    {getReturnCasePrintButtonText()}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
}

